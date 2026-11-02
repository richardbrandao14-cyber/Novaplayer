//! Last real source-query observation. No addresses, credentials, pings or speed tests.
use std::{
    sync::Mutex,
    time::{Duration, Instant},
};

const FRESH_FOR: Duration = Duration::from_secs(120);
static LAST_QUERY: Mutex<Option<QueryObservation>> = Mutex::new(None);

struct QueryObservation {
    finished: Instant,
    duration_ms: u64,
    success: bool,
}

/// Time to complete a source HTTP query, not RTT, bandwidth or global Internet health.
#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionStatus {
    pub state: &'static str,
    pub duration_ms: Option<u64>,
    pub age_seconds: Option<u64>,
}

impl ConnectionStatus {
    fn unknown(age_seconds: Option<u64>) -> Self {
        Self {
            state: "unknown",
            duration_ms: None,
            age_seconds,
        }
    }
}

pub(crate) fn record(duration: Duration, success: bool) {
    if let Ok(mut last) = LAST_QUERY.lock() {
        *last = Some(QueryObservation {
            finished: Instant::now(),
            duration_ms: duration.as_millis().min(u64::MAX as u128) as u64,
            success,
        });
    }
}

/// Read-only: polling this function never starts a network operation.
pub fn latest() -> ConnectionStatus {
    LAST_QUERY
        .lock()
        .ok()
        .map(|last| snapshot(last.as_ref(), Instant::now()))
        .unwrap_or_else(|| ConnectionStatus::unknown(None))
}

fn snapshot(last: Option<&QueryObservation>, now: Instant) -> ConnectionStatus {
    let Some(last) = last else {
        return ConnectionStatus::unknown(None);
    };
    let age = now.saturating_duration_since(last.finished);
    if age > FRESH_FOR {
        return ConnectionStatus::unknown(Some(age.as_secs()));
    }
    ConnectionStatus {
        state: if last.success { "success" } else { "failure" },
        duration_ms: Some(last.duration_ms),
        age_seconds: Some(age.as_secs()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn no_query_is_not_claimed_as_connected() {
        let status = snapshot(None, Instant::now());
        assert_eq!(status.state, "unknown");
        assert!(status.duration_ms.is_none());
        assert!(status.age_seconds.is_none());
    }

    #[test]
    fn source_query_result_and_duration_are_preserved_without_identifiers() {
        let finished = Instant::now();
        let query = QueryObservation {
            finished,
            duration_ms: 428,
            success: true,
        };
        let success = snapshot(Some(&query), finished + Duration::from_secs(3));
        assert_eq!(success.state, "success");
        assert_eq!(success.duration_ms, Some(428));
        assert_eq!(success.age_seconds, Some(3));
        let failed = QueryObservation {
            success: false,
            ..query
        };
        let failure = snapshot(Some(&failed), finished);
        assert_eq!(failure.state, "failure");
        assert_eq!(failure.duration_ms, Some(428));
        let json = serde_json::to_value(&failure).unwrap();
        assert_eq!(json.as_object().unwrap().len(), 3);
        assert_eq!(json["state"], "failure");
        assert_eq!(json["durationMs"], 428);
    }

    #[test]
    fn old_observation_expires_instead_of_reporting_stale_quality() {
        let finished = Instant::now();
        let query = QueryObservation {
            finished,
            duration_ms: 25,
            success: true,
        };
        assert_eq!(
            snapshot(Some(&query), finished + FRESH_FOR).state,
            "success"
        );
        let expired = snapshot(
            Some(&query),
            finished + FRESH_FOR + Duration::from_millis(1),
        );
        assert_eq!(expired.state, "unknown");
        assert!(expired.duration_ms.is_none());
        assert_eq!(expired.age_seconds, Some(120));
    }
}
