use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CoreError {
    pub code: String,
    pub message: String,
}
pub type CoreResult<T> = Result<T, CoreError>;
impl CoreError {
    pub fn new(code: &str, message: &str) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
        }
    }
    pub fn cancelled() -> Self {
        Self::new("cancelled", "Importação cancelada.")
    }
    pub fn database() -> Self {
        Self::new(
            "database",
            "Não foi possível acessar o banco de dados local.",
        )
    }
}
impl std::fmt::Display for CoreError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.message)
    }
}
impl std::error::Error for CoreError {}
