-- NOVA HUD: somente comandos fixos. Sem URLs, filesystem, subprocessos ou scripts externos.
local input = require "mp.input"
local fullscreen = false
local visible = false
local has_episodes = false
local overlay = mp.create_osd_overlay("ass-events")
local timer
local function draw_header()
    local w, h = mp.get_osd_size()
    if not fullscreen or not visible or not w or w <= 0 then
        overlay:remove()
        mp.disable_key_bindings("nova-top")
        return
    end
    local height = h * 1280 / w
    overlay.res_x = 1280; overlay.res_y = height
    overlay.data = "{\\an7\\pos(0,0)\\bord0\\1c&H101010&\\1a&H40&\\p1}m 0 0 l 1280 0 1280 68 0 68{\\p0}" ..
        "\n{\\an7\\pos(28,23)\\fnSegoe UI\\fs20\\bord0\\1c&HFFFFFF&}‹  Voltar" ..
        "\n{\\an7\\pos(175,27)\\fnSegoe UI\\fs13\\bord0\\1c&HB0B0B0&}NOVA PLAYER" ..
        "\n{\\an7\\pos(960,25)\\fnSegoe UI\\fs16\\bord0\\1c&HFFFFFF&}Ajustes" ..
        "\n{\\an7\\pos(1075,25)\\fnSegoe UI\\fs16\\bord0\\1c&HFFFFFF&}Sair da tela cheia"
    if has_episodes then overlay.data = overlay.data .. "\n{\\an7\\pos(840,25)\\fnSegoe UI\\fs16\\bord0\\1c&HFFFFFF&}Episódios" end
    overlay:update()
    mp.set_mouse_area(0, 0, w, 68 * w / 1280, "nova-top")
    mp.enable_key_bindings("nova-top", "allow-hide-cursor")
end
local function publish_visibility(value)
    visible = value
    mp.set_property_native("user-data/nova", {visibility=value and "visible" or "hidden"})
    draw_header()
end
local function wake()
    if not fullscreen then return end
    if not visible then
        publish_visibility(true)
        mp.commandv("script-message-to", "osc", "osc-visibility", "always")
    end
    if timer then timer:kill() end
    timer = mp.add_timeout(5, function()
        publish_visibility(false)
        mp.commandv("script-message-to", "osc", "osc-visibility", "never")
    end)
end
local function ui(action) wake(); mp.commandv("script-message", "nova-ui", action) end
local function seek(delta)
    wake()
    if mp.get_property_bool("seekable", false) then mp.commandv("seek", delta, "relative") end
end
local function select_speed()
    wake()
    local speeds = {0.5, 0.75, 1, 1.25, 1.5, 2}
    local labels = {}
    for i, value in ipairs(speeds) do labels[i] = tostring(value) .. "×" end
    input.select({prompt="Velocidade", items=labels, submit=function(i)
        if speeds[i] then mp.set_property_number("speed", speeds[i]) end
    end})
end
local function select_track(kind)
    wake()
    local ids, labels = {}, {}
    if kind == "sub" then ids[1] = "no"; labels[1] = "Desativadas" end
    for _, track in ipairs(mp.get_property_native("track-list", {})) do
        if track.type == kind then
            ids[#ids + 1] = track.id
            -- Não exibir títulos brutos, nomes de arquivos ou URLs do provedor.
            labels[#labels + 1] = track.lang or ("Faixa " .. tostring(track.id))
        end
    end
    if #ids == 0 then return end
    input.select({prompt=kind == "audio" and "Áudio" or "Legendas",items=labels,submit=function(i)
        if ids[i] then mp.set_property(kind == "audio" and "aid" or "sid", tostring(ids[i])) end
    end})
end
local function select_volume()
    wake()
    local labels = {"Silenciar"}
    for value = 10, 100, 10 do labels[#labels+1] = tostring(value) .. "%" end
    input.select({prompt="Volume", items=labels, submit=function(i)
        local value = (i-1)*10
        if value >= 0 and value <= 100 then mp.set_property_number("volume", value); mp.set_property_bool("mute", value == 0) end
    end})
end
mp.register_script_message("volume", select_volume)
local function settings()
    wake()
    input.select({prompt="Reprodução",items={"Velocidade", "Áudio", "Legendas", "Volume", "Alternar compatibilidade de vídeo"},submit=function(i)
        if i==1 then select_speed() elseif i==2 then select_track("audio") elseif i==3 then select_track("sub") elseif i==4 then select_volume() elseif i==5 then mp.set_property("hwdec", mp.get_property("hwdec") == "no" and "auto-safe" or "no") end
    end})
end
mp.register_script_message("settings", settings)
mp.register_script_message("speed", select_speed)
mp.register_script_message("audio", function() select_track("audio") end)
mp.register_script_message("sub", function() select_track("sub") end)
mp.register_script_message("backward", function() seek(-10) end)
mp.register_script_message("forward", function() seek(10) end)
mp.add_forced_key_binding("SPACE", "nova-pause", function() wake(); mp.commandv("cycle", "pause") end)
mp.add_forced_key_binding("LEFT", "nova-backward", function() seek(-10) end)
mp.add_forced_key_binding("RIGHT", "nova-forward", function() seek(10) end)
mp.add_forced_key_binding("m", "nova-mute", function() wake(); mp.commandv("cycle", "mute") end)
mp.add_forced_key_binding("f", "nova-fullscreen", function() ui("fullscreen") end)
mp.add_forced_key_binding("ESC", "nova-escape", function() ui("escape") end)
mp.add_forced_key_binding("BS", "nova-back", function() ui("back") end)
mp.add_forced_key_binding("MBTN_LEFT_DBL", "nova-fullscreen-mouse", function() ui("fullscreen") end)
mp.observe_property("pause", "bool", function(_, paused)
    if fullscreen then wake() else mp.commandv("script-message-to", "osc", "osc-visibility", paused and "always" or "auto") end
end)

mp.register_script_message("fullscreen-chrome", function(value, episodes)
    has_episodes = episodes == "yes"
    fullscreen = value == "yes"
    if fullscreen then wake(); draw_header() else
        if timer then timer:kill() end
        publish_visibility(false)
        mp.commandv("script-message-to", "osc", "osc-visibility", mp.get_property_bool("pause", false) and "always" or "auto")
    end
end)
mp.register_script_message("activity", wake)
mp.add_key_binding("ANY_UNICODE", "nova-wake", wake)
mp.add_key_binding("TAB", "nova-wake-tab", wake)
mp.add_key_binding("ENTER", "nova-wake-enter", wake)
mp.add_key_binding("UP", "nova-wake-up", wake)
mp.add_key_binding("DOWN", "nova-wake-down", wake)
local last_x, last_y
mp.observe_property("mouse-pos", "native", function(_, value)
    if value and value.hover and (value.x ~= last_x or value.y ~= last_y) then
        last_x = value.x; last_y = value.y; wake()
    end
end)
mp.observe_property("osd-dimensions", "native", draw_header)
mp.set_key_bindings({{"MBTN_LEFT", function()
    local x = mp.get_mouse_pos()
    local w = mp.get_osd_size()
    x = x * 1280 / math.max(1, w)
    wake()
    if x < 150 then ui("back") elseif x >= 1070 then ui("fullscreen") elseif x >= 940 then settings() elseif x >= 815 and has_episodes then ui("episodes") end
end}}, "nova-top", "force")
mp.disable_key_bindings("nova-top")
mp.commandv("script-message", "nova-ui", "hud-ready")
