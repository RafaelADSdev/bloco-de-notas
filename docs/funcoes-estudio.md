# Funções de desenho e referência analisada

O arquivo fornecido é o Autodesk SketchBook para Android, pacote `com.adsk.sketchbook`, versão 5.1.9. SHA-256 `897d8d3ac69f88f32ae9518ca48c9c20b26b7580261ead92f0803fa0facc4eab`.

O REA 6.5.0 concluiu o inventário estático em `ev_600e4354c21e38c0dc29bca540ee01b00e8da965c34bd4c26c56fe8c7cb09c35`. O grafo registrou 1.730 ocorrências no APK, incluindo o DEX, bibliotecas nativas e recursos. O Android SDK confirmou a versão e leu a tabela de recursos. A inspeção de classes do REA exigia um provedor JADX 0.7.1 que estava indisponível neste ambiente. As evidências abaixo identificam funções pelo conteúdo do pacote. A documentação oficial ajuda a descrever o comportamento público.

| Família | Evidência estática no APK | Implementação no Linha Clara |
| --- | --- | --- |
| Pincéis e traço | Biblioteca, parâmetros de espaçamento e ponta, famílias de textura, esfuminho e traço preditivo | Carimbo de forma configurável, respingos, esfuminho, espaçamento, estabilização e correção de linhas quase retas. Pressão, tamanho e opacidade continuam disponíveis. |
| Guias e simetria | Comandos de guia, etiquetas de perspectiva de um, dois e três pontos e centro de simetria | Régua inclinável, elipse, três modos de perspectiva, simetria livre e radial com centro e quantidade ajustáveis. |
| Desenho e seleção | Comandos de seleção, preenchimento, transformação, estilo de forma e inversão da vista | Laço preenchido, preenchimento e contorno de seleção, degradê linear, formas, transformações de seleção e espelhamento da visualização. |
| Camadas | Ajuste HSL, balanço de cor, bloqueio de transparência, mesclagem e etiquetas | Ajustes HSL e RGB, etiquetas, recorte pela camada abaixo, bloqueio de transparência, mesclagem e modos compatíveis com Canvas. |
| Cor | Roda de cores, conta-gotas e cor anterior | Roda, seleção por amostra, harmonias, cores guardadas e extração de uma imagem. |
| Gravação | Comando e estados de timelapse | Captura optativa das etapas da sessão. Gera um vídeo de até cerca de 30 segundos em navegadores que oferecem gravação de canvas. |
| Arquivos | Comando de importação de imagem e recursos de salvamento | PNG, PNG transparente, JPEG, PDF, PSD raster em camadas e cópia editável em JSON com reimportação. |

O estúdio preserva o formato e os desenhos armazenados localmente. A implementação usa código e recursos próprios. A cobertura segue as funções verificáveis e os limites do editor, com diferenças na coleção de pincéis, nos parâmetros de inclinação e textura, nas grades e nos modos especiais de mesclagem.

O PSD aceita camadas raster RGB de 8 bits. Grupos, máscaras de pixels, textos editáveis e camadas de ajuste externas exigem conversão para camadas raster antes da importação. A cópia editável do Linha Clara preserva os ajustes e operações do próprio estúdio. [Formato utilizado pelo ag-psd](https://github.com/Agamnentzar/ag-psd/blob/master/README_PSD.md)

[Visão geral das ferramentas](https://help.sketchbook.com/docs/tools-overview) · [Ferramentas no celular](https://help.sketchbook.com/docs/tools-in-sketchbook) · [Pincéis de mistura](https://help.sketchbook.com/docs/blending-brushes)
