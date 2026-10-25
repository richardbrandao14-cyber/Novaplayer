//! Superfície HWND filha, criada e reposicionada exclusivamente na thread da janela.
use crate::services::{Result, ServiceError};
use std::{ffi::c_void, sync::Mutex};
#[derive(Clone, Copy, serde::Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SurfaceRect {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
    pub visible: bool,
}
impl SurfaceRect {
    fn validate(self) -> Result<Self> {
        if self.x < 0
            || self.y < 0
            || !(1..=32768).contains(&self.width)
            || !(1..=32768).contains(&self.height)
        {
            return Err(ServiceError::new(
                "validation",
                "Área de reprodução inválida.",
            ));
        }
        Ok(self)
    }
}
#[link(name = "user32")]
unsafe extern "system" {
    fn CreateWindowExW(
        ex: u32,
        class: *const u16,
        name: *const u16,
        style: u32,
        x: i32,
        y: i32,
        w: i32,
        h: i32,
        parent: *mut c_void,
        menu: *mut c_void,
        instance: *mut c_void,
        param: *mut c_void,
    ) -> *mut c_void;
    fn SetWindowPos(
        window: *mut c_void,
        after: *mut c_void,
        x: i32,
        y: i32,
        w: i32,
        h: i32,
        flags: u32,
    ) -> i32;
    fn ShowWindow(window: *mut c_void, command: i32) -> i32;
}
pub struct VideoSurface {
    handle: Mutex<Option<isize>>,
}
impl VideoSurface {
    pub fn new() -> Self {
        Self {
            handle: Mutex::new(None),
        }
    }
    pub fn handle(&self) -> Result<isize> {
        self.handle
            .lock()
            .map_err(|_| surface_error())?
            .ok_or_else(surface_error)
    }
    // Chamado por run_on_main_thread; nenhum HWND é aceito do frontend.
    pub fn place(&self, parent: isize, rect: SurfaceRect) -> Result<()> {
        let rect = rect.validate()?;
        let mut handle = self.handle.lock().map_err(|_| surface_error())?;
        let hwnd = if let Some(value) = *handle {
            value
        } else {
            let class: Vec<u16> = "STATIC\0".encode_utf16().collect();
            let title: Vec<u16> = "NOVA Video\0".encode_utf16().collect();
            let ptr = unsafe {
                CreateWindowExW(
                    0,
                    class.as_ptr(),
                    title.as_ptr(),
                    0x40000000 | 0x04000000 | 0x02000000 | 4,
                    rect.x,
                    rect.y,
                    rect.width,
                    rect.height,
                    parent as *mut c_void,
                    std::ptr::null_mut(),
                    std::ptr::null_mut(),
                    std::ptr::null_mut(),
                )
            };
            if ptr.is_null() {
                return Err(surface_error());
            }
            let value = ptr as isize;
            *handle = Some(value);
            value
        };
        if !rect.visible {
            unsafe { ShowWindow(hwnd as *mut c_void, 0) };
            return Ok(());
        }
        if unsafe {
            SetWindowPos(
                hwnd as *mut c_void,
                std::ptr::null_mut(),
                rect.x,
                rect.y,
                rect.width,
                rect.height,
                0x10 | 0x40,
            )
        } == 0
        {
            return Err(surface_error());
        }
        Ok(())
    }
}
fn surface_error() -> ServiceError {
    ServiceError::new(
        "player_surface",
        "Não foi possível preparar o vídeo dentro da janela.",
    )
}
