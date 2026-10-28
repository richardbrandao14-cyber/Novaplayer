# Mídia sintética de teste

`tv-av.mp4`: oito segundos de padrão animado FFmpeg testsrc2 + seno 440 Hz reduzido em volume. Vídeo H.264 Constrained Baseline, nível 3.1, 1280×720/25 fps/yuv420p; áudio AAC-LC estéreo/48 kHz. HLS em hls/ usa a mesma mídia sem recodificação, segmentos de dois segundos. Nenhum conteúdo de canal/filme real ou credencial.

Reprodução na LG ainda precisa ser confirmada pelo proprietário. O padrão não mede qualidade de Internet nem compatibilidade de todas as fontes.

`tv-uhd.mp4`: quatro segundos de padrão sintético testsrc2 com grade e texto NEX, 3840×2160/24 fps, H.264 High nível 5.1, yuv420p, SDR; AAC-LC estéreo/48 kHz, tom 440 Hz reduzido. Gerado localmente por FFmpeg/libx264, máximo configurado 18 Mbit/s, faststart; ffprobe confirmou dimensões, codec, duração de 4 s e 8.027.788 bytes. Sem HDR ou alegação de teste físico. A amostra serve para validar o decoder 4K da TV, separadamente da resolução lógica da interface.
