tecla-e.png: a logo original (a tecla "E" sobre preto puro, sem transparência).
Os arquivos do site saem dela com o ffmpeg: o preto vira transparente pelo brilho de cada pixel (A = (max(r,g,b) - 6) * 2,4)
e a cor é "despremultiplicada" (c * 255 / A), então a borda translúcida não fica com halo escuro.
Recorte: crop=1160:1160:47:82 (a tecla centrada).
