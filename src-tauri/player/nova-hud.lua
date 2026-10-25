-- NOVA HUD: somente comandos fixos. Sem URLs, filesystem, subprocessos ou scripts externos.
local input = require "mp.input"
local function ui(action) mp.commandv("script-message", "nova-ui", action) end
local function seek(delta)
    if mp.get_property_bool("seekable", false) then mp.commandv("seek", delta, "relative") end
end
local function select_speed()
    local speeds = {0.5, 0.75, 1, 1.25, 1.5, 2}
    local labels = {}
    for i, value in ipairs(speeds) do labels[i] = tostring(value) .. "×" end
    input.select({prompt="Velocidade", items=labels, submit=function(i)
        if speeds[i] then mp.set_property_number("speed", speeds[i]) end
    end})
end
local function select_track(kind)
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
mp.register_script_message("settings", function()
    input.select({prompt="Reprodução",items={"Velocidade", "Áudio", "Legendas"},submit=function(i)
        if i==1 then select_speed() elseif i==2 then select_track("audio") elseif i==3 then select_track("sub") end
    end})
end)
mp.register_script_message("speed", select_speed)
mp.register_script_message("audio", function() select_track("audio") end)
mp.register_script_message("sub", function() select_track("sub") end)
mp.register_script_message("backward", function() seek(-10) end)
mp.register_script_message("forward", function() seek(10) end)
mp.add_forced_key_binding("SPACE", "nova-pause", function() mp.commandv("cycle", "pause") end)
mp.add_forced_key_binding("LEFT", "nova-backward", function() seek(-10) end)
mp.add_forced_key_binding("RIGHT", "nova-forward", function() seek(10) end)
mp.add_forced_key_binding("m", "nova-mute", function() mp.commandv("cycle", "mute") end)
mp.add_forced_key_binding("f", "nova-fullscreen", function() ui("fullscreen") end)
mp.add_forced_key_binding("ESC", "nova-escape", function() ui("escape") end)
mp.add_forced_key_binding("BS", "nova-back", function() ui("back") end)
mp.add_forced_key_binding("MBTN_LEFT_DBL", "nova-fullscreen-mouse", function() ui("fullscreen") end)
mp.observe_property("pause", "bool", function(_, paused)
    mp.commandv("script-message-to", "osc", "osc-visibility", paused and "always" or "auto")
end)

mp.commandv("script-message", "nova-ui", "hud-ready")
