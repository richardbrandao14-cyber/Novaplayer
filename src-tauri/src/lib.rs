#[cfg(all(feature = "desktop", windows))]
mod commands;
pub mod core;
#[cfg(all(feature = "desktop", windows))]
mod native;
#[cfg(all(feature = "desktop", windows))]
mod player;
pub mod services;
#[cfg(all(feature = "desktop", windows))]
mod surface;
#[cfg(all(feature = "desktop", windows))]
pub fn run() {
    native::run();
}
