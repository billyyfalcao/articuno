# PY-03 — investigação do vídeo estrangeiro

Ambiente: Windows, Python 3.13.7, OpenCV 5.0.0, Tesseract 5.4.0 / eng.
Arquivo local: `videos/License_Plate_Detection_Test_1080p.mp4`.
Frames decodificados diretamente do MP4, sem usar JPEG intermediário como
entrada do OCR. JPEG/PNG auxiliares de inspeção permanecem na pasta ignorada.

## Causas verificadas

- Vídeo 1920×1080, 30 fps, 1.800 frames; não houve redução global de resolução.
  Isso não significa placa em alta resolução: os recortes medidos têm apenas
  74–94 pixels de largura e 22–25 de altura, incluindo bordas. Há desfoque e
  poucos pixels distinguindo O/0, S/5 e I/1.
- O ensaio anterior usou ROI manual fixa `[615,850,100,40]` e intervalo 300
  (10 segundos). O carro move-se vários pixels entre frames próximos: a ROI
  deixa de conter a placa, e o motor lê para-choque/fundo. Não era uma análise
  da imagem inteira. Sem ROI, o código usa PSM 11 para texto esparso.
- Para medir o efeito temporal, inspecionamos frames 70, 80, 90, 100, 110,
  150 e 210, e executamos matrizes OCR nos recortes anotados dos frames 90,
  100, 110, 150 e 210. As ROIs foram definidas visualmente; não há rastreador.
  Um intervalo de 10 frames (0,33 s) fornece mais oportunidades nessa passagem
  do que 300, mas **não basta** sem enquadrar a placa em cada frame.

## Comparações observadas

Referências abaixo são transcrições visuais, não consultas a cadastro nem
validação externa. A normalização de espaços não resolve os erros indicados.

| Frame / ROI x,y,w,h | Preparação / PSM | Texto bruto | Menor confiança |
|---|---|---|---|
| 90 / 628,855,77,24 | original / 6 | GXIS OCI | 0,25 |
| 110 / 603,929,82,25 | cinza 4× / 7 | GXIS OGJ | 0,57 |
| 150 / 1145,805,79,23 | cinza / 7 | APOS JED | 0,64 |
| 150 / 1145,805,79,23 | cinza 3× + Otsu / 7 | APOS JEO | 0,91 |
| 210 / 1203,1014,94,24 | cinza / 7 | APOS JEO | 0,86 |
| 210 / 548,896,85,24 | cinza / 7 | vazio | — |
| 210 / 548,896,85,24 | cinza 3× / 7 | KHOS 27K | 0,72 |

No veículo prateado, a referência visual é `AP05 JEO`: houve melhora parcial
de APOS JED para APOS JEO, mas persistem **dois caracteres errados**. A confiança
0,91 nessa leitura incorreta demonstra por que ela não é probabilidade de acerto.
Nenhuma das leituras completas comparadas foi comprovada correta.

## Pré-processamento e configuração

Foram comparados original, cinza, ampliação cúbica 2×/3×/4×, Otsu, CLAHE e
margem branca. Ampliação não recupera detalhes que o vídeo não contém; os
resultados variaram por frame. Otsu melhorou um caractere no frame 150 e
piorou outros recortes. Não há evidência para impor um desses filtros globalmente.

PSM 6 (bloco), 7 (linha), 8 (palavra) e 13 (linha bruta) foram experimentados.
PSM 7 é semanticamente adequado a uma placa recortada em linha única, mas não
eliminou as confusões. Também foram experimentadas desativação dos dicionários
e whitelist alfanumérica; não produziram acerto completo. A whitelist alterou
saídas e algumas confianças caíram para zero. Não foi incorporada ao serviço.

Não foi feita substituição pós-OCR, votação para forçar o formato brasileiro,
mudança do texto esperado para coincidir com a saída ou seleção por confiança
como prova de acerto. Nenhum evento automático foi gerado.

## Reprodução

Exemplo PowerShell, dentro da pasta do serviço:

```powershell
.venv/Scripts/python.exe tools/diagnose_ocr.py videos/License_Plate_Detection_Test_1080p.mp4 --tesseract 'C:/Program Files/Tesseract-OCR/tesseract.exe' --frame 150 --roi 1145 805 79 23
```

O utilitário imprime todas as variantes (original, cinza, cinza 3×, Otsu 3×,
CLAHE 3× × PSM 6/7/13), inclusive falhas. Não escreve mídia nem muda o serviço.
Execute o frame 210 com as ROIs da tabela para comparar. Coordenadas são
específicas desta amostra, não localização automática generalizável.

## Conclusão e pendências

O diagnóstico explica a falha inicial e melhora a capacidade de reproduzir
o ensaio. **Ainda não há reconhecimento completo correto comprovado de placa
real.** Por isso, o pipeline padrão foi preservado, sem declarar uma correção
que os dados não sustentam. O PR continua experimental e a Issue permanece
aberta. Fotografias brasileiras reais autorizadas também continuam pendentes.
Uma amostra com placa maior/nítida ou recorte real de melhor qualidade permitirá
separar o limite de resolução do limite do motor antes de investir no PY-09.
