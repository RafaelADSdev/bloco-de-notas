---
name: Linha Clara
description: "Ateliê digital em grafite fosco e âmbar, com papel e tinta próprios de cada documento."
colors:
  canvas: "#181715"
  sidebar: "#201e1b"
  surface: "#25221e"
  raised: "#302c26"
  field: "#1c1a17"
  stage: "#151412"
  ink: "#f4ece0"
  muted: "#bcb0a0"
  line: "#3b352d"
  border: "#4a4136"
  control-line: "#786a58"
  accent: "#edb773"
  accent-strong: "#f6c88e"
  accent-tint: "#3f3022"
  on-accent: "#251910"
  light-canvas: "#f6f0e6"
  light-sidebar: "#eee6d9"
  light-surface: "#fffaf2"
  light-raised: "#e9dfd0"
  light-field: "#fffcf6"
  light-stage: "#e8dfd1"
  light-ink: "#2b241c"
  light-muted: "#675a4a"
  light-line: "#ded1c0"
  light-border: "#c6b8a4"
  light-control-line: "#96836b"
  light-accent: "#7e460e"
  light-accent-strong: "#602e06"
  light-accent-tint: "#f0dcc1"
  light-accent-fill: "#895018"
  light-on-accent: "#fffbf4"
  danger: "#ffaba0"
  danger-fill: "#a23d34"
  on-danger: "#fff9f5"
  danger-tint: "#442823"
  success: "#b8d7a5"
  light-danger: "#8e352d"
  light-danger-tint: "#f7e0da"
  light-success: "#395b2c"
  paper: "#fffefa"
  paper-ink: "#243129"
typography:
  display:
    fontFamily: "Instrument Serif, Georgia, serif"
    fontSize: "clamp(70px, 7.1vw, 96px)"
    fontWeight: 400
    lineHeight: 0.86
    letterSpacing: "-0.032em"
  headline:
    fontFamily: "DM Sans Variable, Segoe UI, sans-serif"
    fontSize: "46px"
    fontWeight: 650
    lineHeight: 1.06
    letterSpacing: "-0.055em"
  title:
    fontFamily: "DM Sans Variable, Segoe UI, sans-serif"
    fontSize: "17px"
    fontWeight: 710
    letterSpacing: "-0.02em"
  body:
    fontFamily: "DM Sans Variable, Segoe UI, sans-serif"
    fontSize: "14px"
  label:
    fontFamily: "DM Sans Variable, Segoe UI, sans-serif"
    fontSize: "11px"
    lineHeight: 1.25
  action:
    fontFamily: "DM Sans Variable, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 690
    lineHeight: 1.25
rounded:
  sheet: "2px"
  detail: "4px"
  control: "6px"
  card: "7px"
  popover: "8px"
  dialog: "10px"
spacing:
  compact: "6px"
  inline: "8px"
  control: "10px"
  group: "12px"
  gutter: "14px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.action}"
    rounded: "{rounded.control}"
    padding: "0 14px"
  button-primary-hover:
    backgroundColor: "{colors.accent-strong}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.action}"
    rounded: "{rounded.control}"
    padding: "0 14px"
  button-destructive:
    backgroundColor: "{colors.danger-fill}"
    textColor: "{colors.on-danger}"
    typography: "{typography.action}"
    rounded: "{rounded.control}"
    padding: "0 14px"
  button-link:
    backgroundColor: "transparent"
    textColor: "{colors.accent}"
    typography: "{typography.action}"
    rounded: "{rounded.control}"
    padding: "0 4px"
  button-icon-pressed:
    backgroundColor: "{colors.accent-tint}"
    textColor: "{colors.accent}"
    rounded: "{rounded.control}"
    size: "36px"
  search-field:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 10px"
  navigation-current:
    backgroundColor: "{colors.accent-tint}"
    textColor: "{colors.accent}"
    rounded: "{rounded.control}"
    padding: "0 11px"
  document-card:
    backgroundColor: "{colors.canvas}"
    rounded: "{rounded.card}"
  dialog:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.dialog}"
    padding: "21px"
---

# Design System: Linha Clara

## Overview

**Creative North Star: "Ateliê de grafite e papel"**

Grafite quente e fosco contorna o trabalho. O âmbar marca ações e escolhas. A fotografia original de papel e lápis na abertura apresenta a mesma materialidade que reaparece nas capas da biblioteca e nas folhas dos editores.

As áreas de criação abrem espaço para o documento, com barras de ferramentas baixas e painéis compactos. O tema claro usa neutros quentes e âmbar escuro nos mesmos papéis funcionais.

**Key Characteristics:**

- Fundo grafite com camadas de tom e linhas finas.
- Acento âmbar para agir, localizar e selecionar.
- Capas geradas com os dados do documento.
- Papel, tinta e desenho independentes do tema da interface.

## Colors

### Primary

- **Âmbar de ação.** As ações primárias usam fundo preenchido e texto de alto contraste. Navegação atual e ferramentas selecionadas usam fundo âmbar tonal com ícone e texto em âmbar.
- **Âmbar no tema claro.** O âmbar escuro atende ícones, links e foco. O preenchimento do botão tem valor próprio e texto claro.

### Neutral

- **Grafite e creme.** Fundo geral, painéis laterais, superfícies elevadas, campos e área ao redor do papel têm tons próprios nos dois temas. Texto principal e metadados formam dois níveis de contraste.
- **Linhas funcionais.** Use linhas discretas em divisões e o contorno de controle mais forte em campos e botões secundários.
- **Estados.** Vermelho sinaliza erro e ações destrutivas. Verde aparece nos indicadores de confirmação. O papel claro e a tinta do texto têm valores compartilhados pelos dois temas.

**The Independent Paper Rule.** O seletor da biblioteca troca as cores da interface. Preserve as cores das capas, páginas, tintas e desenhos ao mudar de tema.

## Typography

Instrument Serif tem peso 400 e itálico autêntico. DM Sans Variable sustenta o restante da interface com pesos graduais. As duas famílias são carregadas localmente.

- **Display.** Texto expressivo da abertura com entrelinha curta e ênfase itálica em âmbar. Instrument Serif também aparece nos títulos do documento de texto.
- **Headline.** Título da biblioteca com entrelinha justa e escala menor no celular (36px).
- **Title.** Títulos compactos de seção, documento e painel identificam o trabalho em curso.
- **Body.** Sans legível para instruções, campos e navegação. A descrição da abertura tem medida curta (34ch).
- **Label.** Metadados pequenos e atenuados. Contagem de itens e controles de página e zoom usam números tabulares.

## Layout

- **Biblioteca.** Barra lateral fixa na rolagem, barra superior e conteúdo central limitado a 1320px. Busca, filtro por tipo de arquivo e ordenação antecedem a coleção. A navegação vira gaveta sobreposta até 820px. A grade passa de três colunas para duas até 550px, com busca em linha própria e espaço para títulos em duas linhas.
- **Editores.** Cabeçalho e rodapé delimitam a área de trabalho. As ferramentas ficam junto ao documento em uma faixa horizontal rolável. O painel de páginas vira sobreposição até 700px.
- **Estúdio de desenho.** O palco flexível fica entre pincéis e camadas. Até 760px, os painéis abrem sobre o palco, as ferramentas se agrupam em linhas e as ações de criar e salvar ficam na segunda linha do cabeçalho.
- **Meus desenhos.** Uma tela própria reúne prévias proporcionais dos desenhos, com nome e tamanho do quadro. A ação principal cria outro desenho. A grade passa de três para duas colunas até 550px.
- **Abertura.** Composição em duas colunas com texto e fotografia em moldura fina. Até 720px, a fotografia vira uma faixa horizontal abaixo das ações.

## Elevation & Depth

A diferença tonal e os filetes definem a posição dos painéis. Sombras suaves dão altura a menus, diálogos, folhas e objetos da biblioteca. As capas de caderno acrescentam uma lombada interna.

**The Tonal Layers Rule.** Use a elevação tonal para estruturar a interface. Reserve sombras para sobreposições e objetos apoiados na área de trabalho.

## Shapes

Controles têm cantos discretos, normalmente de 6px. Cartões usam 7px, menus 8px e diálogos 10px. Folhas, molduras e miniaturas mantêm cantos mais retos. Círculos aparecem nas amostras de tinta e nos marcadores de metadados.

## Components

### Buttons and inputs

Ações primárias usam âmbar sólido. Botões secundários usam fundo de superfície com contorno, e links de ação sublinham no hover. O botão de ícone começa transparente e recebe âmbar tonal quando pressionado como estado de seleção. Dê nomes acessíveis aos controles que exibem somente ícones.

Campos usam fundo próprio e contorno de controle. O foco de teclado recebe anel âmbar de 2px com afastamento, incluindo a borda externa da busca. Use a cor do foco do papel no editor de texto para preservar contraste sobre a folha.

### Navigation and panels

O destino atual recebe fundo âmbar tonal, texto em âmbar e borda discreta. Ícones de traço acompanham as ações. Diálogos usam superfície elevada, sombra difusa e fundo de bloqueio translúcido. A fotografia da abertura é revelada em 680 ms, com uma passagem breve de luz. Menus, painéis e áreas de trabalho entram em 180–270 ms. As capas têm entrada escalonada e se deslocam levemente ao passar o cursor. A folha do editor muda de opacidade durante a entrada e mantém a posição. O movimento segue a preferência do dispositivo por padrão e pode ser ajustado nas opções da biblioteca.

### Document cards

Represente cadernos pela lombada, notas e PDFs por folhas, quadros brancos por retângulos largos pontilhados e pastas por ícones coloridos. Gere a capa com a cor e o título do documento. Mantenha título, tipo e data nos metadados da coleção. Pastas mostram contagem e itens demonstrativos exibem a identificação “Exemplo”.

**The Document Cover Rule.** Use o formato e os dados do próprio documento para construir sua miniatura.

## Do's and Don'ts

- **Do** mantenha o foco de teclado visível nos dois temas.
- **Do** use ícones de traço e preserve rótulos acessíveis em botões compactos.
- **Do** respeite a preferência de movimento reduzido.
- **Don't** aplique o tema da interface às cores do documento.
- **Don't** use a cor de preenchimento primário para erros ou ações destrutivas.
