use crate::core::{
    db::Protector,
    error::{CoreError, CoreResult},
};
/// Production secrets are encrypted for the current Windows account using DPAPI.
/// Other systems intentionally have no plaintext fallback.
pub struct WindowsProtector;
impl Protector for WindowsProtector {
    fn encrypt(&self, value: &str) -> CoreResult<Vec<u8>> {
        protect(value.as_bytes(), false)
    }
    fn decrypt(&self, value: &[u8]) -> CoreResult<String> {
        String::from_utf8(protect(value, true)?).map_err(|_| failure())
    }
}
fn failure() -> CoreError {
    CoreError {
        code: "secret_storage".into(),
        message: "Não foi possível proteger ou acessar as credenciais deste usuário Windows."
            .into(),
    }
}
#[cfg(not(windows))]
fn protect(_value: &[u8], _decrypt: bool) -> CoreResult<Vec<u8>> {
    Err(failure())
}
#[cfg(windows)]
fn protect(value: &[u8], decrypt: bool) -> CoreResult<Vec<u8>> {
    use windows_sys::Win32::{
        Foundation::LocalFree,
        Security::Cryptography::{
            CryptProtectData, CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
        },
    };
    if value.len() > u32::MAX as usize {
        return Err(failure());
    }
    let input = CRYPT_INTEGER_BLOB {
        cbData: value.len() as u32,
        pbData: value.as_ptr() as *mut u8,
    };
    let mut output = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: std::ptr::null_mut(),
    };
    // API owns output allocation. No prompts or machine-wide protection; scope is user.
    let success = unsafe {
        if decrypt {
            CryptUnprotectData(
                &input,
                std::ptr::null_mut(),
                std::ptr::null(),
                std::ptr::null(),
                std::ptr::null(),
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut output,
            )
        } else {
            CryptProtectData(
                &input,
                std::ptr::null(),
                std::ptr::null(),
                std::ptr::null(),
                std::ptr::null(),
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut output,
            )
        }
    };
    if success == 0 || output.pbData.is_null() {
        return Err(failure());
    }
    let result =
        unsafe { std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec() };
    unsafe {
        LocalFree(output.pbData as *mut core::ffi::c_void);
    }
    Ok(result)
}
#[cfg(all(test, windows))]
mod tests {
    use super::*;
    #[test]
    fn windows_dpapi_roundtrip() {
        let p = WindowsProtector;
        let plain = "fixture-secret-123";
        let sealed = p.encrypt(plain).unwrap();
        assert!(!sealed.windows(plain.len()).any(|b| b == plain.as_bytes()));
        assert_eq!(p.decrypt(&sealed).unwrap(), plain);
    }
}
