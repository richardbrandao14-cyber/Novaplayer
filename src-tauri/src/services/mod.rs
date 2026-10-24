pub mod cache;
pub mod http;
pub mod imports;
pub mod secrets;
pub mod xtream;

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceError {
    pub code: &'static str,
    pub message: &'static str,
}
impl ServiceError {
    pub fn new(code: &'static str, message: &'static str) -> Self {
        Self { code, message }
    }
    pub fn storage() -> Self {
        Self::new("storage", "Não foi possível acessar o armazenamento local.")
    }
    pub fn cancelled() -> Self {
        Self::new("cancelled", "Importação cancelada.")
    }
}
impl std::fmt::Debug for ServiceError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ServiceError")
            .field("code", &self.code)
            .finish()
    }
}
impl std::fmt::Display for ServiceError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.message)
    }
}
impl std::error::Error for ServiceError {}
pub type Result<T> = std::result::Result<T, ServiceError>;
