# Monitor Control Spec

## Product Summary
Monitor Control e um app Electron para Linux que serve como interface grafica para `ddcutil`, focado em monitores externos. O app permite ajustar propriedades como brilho, contraste, ganho RGB, nitidez e outros controles suportados pelo monitor, com salvamento de perfis em JSON.

## Audience
- usuarios Linux com monitores externos DDC/CI
- pessoas que alternam configuracoes por contexto
- quem precisa compartilhar presets com outras pessoas

## Functional Scope
- detectar monitores externos conectados
- mostrar informacoes basicas do monitor
- mostrar apenas capacidades suportadas
- permitir ajuste de valores em tempo real
- salvar a configuracao atual como perfil
- importar perfil de JSON externo
- exportar perfil para JSON
- aplicar perfil salvo a um monitor

## Architecture

### Renderer
- React para interface
- painel principal com controles ao vivo
- biblioteca de perfis

### Preload
- camada IPC segura usando `contextBridge`

### Main
- cria a janela Electron
- integra com `ddcutil`
- le e grava perfis JSON
- orquestra importacao e exportacao

### Shared
- schemas Zod
- tipos de monitor, capacidade e perfil

## Supported Controls
O app inicia com uma lista prioritaria de codigos VCP conhecidos:
- brilho
- contraste
- red gain
- green gain
- blue gain
- input source
- audio volume
- mute
- sharpness
- hue
- saturation

Se o monitor nao suportar um controle, ele nao aparece na UI.

## Profile Format
Os perfis sao gravados em JSON com:
- `version`
- `profileName`
- `createdAt`
- `monitor`
- `settings`
- `meta`

O bloco `settings` usa chave por nome semantico da capacidade e valor numerico inteiro.

## UI Principles
- interface simples
- navegacao direta
- feedback claro de sucesso e erro
- layout responsivo para janelas menores
- visual limpo e sem excesso de elementos

## Operational Notes
- o app depende de `ddcutil`
- o usuario pode precisar adicionar permissao ao grupo `i2c`
- monitores diferentes oferecem conjuntos diferentes de controles

## Next Steps After MVP
- exclusao e edicao de perfis
- hotkeys
- automacao por monitor conectado
- presets visuais por ambiente
- suporte mais detalhado para capabilities dinamicas
