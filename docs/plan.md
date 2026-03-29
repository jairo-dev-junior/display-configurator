# Monitor Control Plan

## Goal
Criar um app desktop para Linux, usando Electron, para controlar caracteristicas fisicas de monitores externos via DDC/CI com uma interface simples e perfis compartilhaveis em JSON.

## Delivery Phases

### Phase 1
- bootstrap Electron + React + TypeScript
- documentacao inicial em `docs/`
- API segura via `preload`
- estrutura de dominio compartilhada

### Phase 2
- integracao com `ddcutil`
- deteccao de monitores externos
- leitura de capacidades suportadas
- aplicacao de valores VCP

### Phase 3
- perfis em JSON
- salvar perfis locais
- importar perfis
- exportar perfis
- aplicar perfis a um monitor selecionado

### Phase 4
- refinamento de interface
- validacao de schemas
- tratamento de erros e diagnosticos
- build e typecheck

## Technical Requirements
- Linux desktop
- `ddcutil` instalado no sistema
- permissao de acesso ao barramento `i2c`
- Node.js 20+ recomendado

## Risks
- nem todo monitor expoe brilho, nitidez, tonalidade ou saturacao via DDC/CI
- alguns monitores respondem de forma inconsistente para certos codigos VCP
- a identificacao do monitor pode variar conforme o ambiente

## Acceptance Criteria
- detectar monitores externos suportados
- listar capacidades disponiveis por monitor
- aplicar controles suportados em tempo real
- salvar perfil atual em JSON
- importar e exportar perfis JSON
- aplicar um perfil salvo em um monitor selecionado
- exibir erros de dependencia e execucao com mensagens claras
