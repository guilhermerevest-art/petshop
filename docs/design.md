# Design

Guia visual e de escrita do sistema. Vale para a gestão, o portal do tutor e o site.

## Briefing

- **Assunto:** gestão de pet shops de banho e tosa no Brasil.
- **Quem usa:**
  - dono e recepção, no computador do balcão;
  - banhistas, em tablet, muitas vezes com as mãos molhadas;
  - tutores, no celular (a partir da Fase 2).
- **Trabalho principal:** colocar o pet shop para rodar em minutos e tocar o dia sem atrito.
- **Pedido do cliente:** "muito fácil de usar, completo, e que as pessoas adotem".

## Ideia central: o quadro do dia em azulejos

Todo pet shop de banho e tosa tem um quadro (branco, de cortiça ou no caderno) com os horários do dia e os pets em cada um. O sistema traduz esse quadro em **azulejos**: cada vaga de um horário é um azulejo; o pet agendado ocupa o azulejo. As linhas entre os azulejos (o **rejunte**) separam as áreas da interface, no lugar de sombras e cartões flutuantes.

Essa é a única ousadia visual. O resto é calmo e disciplinado para não competir com ela.

## Tokens

### Cores

| Nome | Hex | Uso |
|---|---|---|
| Espuma | `#F4F7F6` | Fundo da página |
| Branco | `#FFFFFF` | Superfícies (painéis, campos) |
| Rejunte | `#DDE5E3` | Bordas e linhas entre áreas |
| Tinta | `#10293A` | Texto principal, botões secundários |
| Tinta suave | `#4A6070` | Texto de apoio (contraste 6:1 sobre Espuma) |
| Azulejo | `#0A6B67` | Ação principal, links, vaga ocupada (contraste 6,3:1 com branco) |
| Azulejo claro | `#DCEFEC` | Vaga livre, seleção, fundo de destaque |
| Patinho | `#F5B82E` | O único acento: "pronto", etapa atual, halo de foco |
| Alerta | `#B3261E` | Erros e ações destrutivas |

Modo escuro fica para depois: o uso principal é em loja iluminada.

### Tipografia

- **Lexend** (variável, auto-hospedada): uma família só, escolhida por legibilidade. Foi desenhada para reduzir o esforço de leitura, o que conversa direto com "muito fácil de usar".
- **Pesos:** 400 no texto, 500 em rótulos e botões, 650 em títulos.
- **Números:** algarismos tabulares em horários, valores e contagens.
- **Escala:** 14 · 16 (base) · 18 · 20 · 24 · 30 · 36 · 48.
- **Linhas de texto:** até 70 caracteres.
- **Sem caixa-alta em rótulos** e sem "sobretítulos" acima dos títulos.

### Forma

| Tipo de elemento | Raio |
|---|---|
| Azulejo | 6px |
| Campo e botão | 10px |
| Painel | 14px |

Os raios variam conforme a hierarquia. Nada de sombra para separar superfícies: o rejunte faz isso.

### Toque e foco

- Alvos de toque com pelo menos 44px, e 48px nos campos.
- Foco visível com contorno Tinta e halo Patinho.
- Movimento só em resposta a ações (conectou, salvou) e respeitando `prefers-reduced-motion`.

## Layout

```
Gestão (computador)                         Gestão (celular/tablet)
┌────────────┬──────────────────────────┐   ┌──────────────────────┐
│ ▦ PetShop  │ Título da página         │   │ ▦ PetShop      Menu  │
│            │ Uma frase do que fazer   │   ├──────────────────────┤
│ Início     │                          │   │ Título               │
│ Configurar │ ┌──────────────────────┐ │   │ ┌──────────────────┐ │
│ ...        │ │ Conteúdo, alinhado   │ │   │ │ Conteúdo         │ │
│            │ │ à esquerda, máx.     │ │   │ └──────────────────┘ │
│            │ │ 720px em formulários │ │   │ [ Ação principal  ]  │
│ Pet shop ▾ │ └──────────────────────┘ │   ├──────────────────────┤
│ Pessoa   ▾ │                          │   │ Início  Agenda  ...  │
└────────────┴──────────────────────────┘   └──────────────────────┘
```

- Texto alinhado à esquerda. Uma ação principal por tela.
- Formulários em uma coluna, com o rótulo acima do campo e uma dica em linguagem simples.
- **Assistente de configuração:** lista de etapas à esquerda. É uma sequência de verdade, por isso tem números. O conteúdo da etapa fica à direita, com "Continuar" sempre no mesmo lugar.

## Escrita

- Português simples, voz ativa, frases curtas.
- O nome das coisas é o que o pet shop entende ("vagas por horário", não "capacidade do slot").
- O botão diz o que acontece: "Conectar WhatsApp", "Salvar horários". O aviso repete o verbo: "Horários salvos".
- Erros dizem o que houve e como resolver, sem pedir desculpas: "Este CNPJ não é válido. Confira os números."
- Tela vazia convida a agir: "Nenhum serviço ainda. Comece pela lista sugerida."
- Sem setas nos botões, sem caixa-alta, sem palavra destacada em cor dentro do título.
