# Glicose Hora a Hora

App web simples que lê os valores de glicose do **xDrip+** (que já está a receber os dados da LinX/Aidex X) e mostra-os de forma clara, hora a hora, em vez do gráfico. Também permite registar refeições e ver o pico de glicose e a subida (delta) provocados por cada uma.

Não precisa de instalação, servidor, nem conta na cloud — são 3 ficheiros estáticos (`web/index.html`, `web/style.css`, `web/app.js`) que correm diretamente no browser do telemóvel.

## Importante: usa sempre a versão local, não o link do GitHub Pages

Este repositório tem uma página publicada em `https://<utilizador>.github.io/Glicose/` (via GitHub Pages), mas serve **apenas para veres o aspeto da app ou testar sem dados reais**. Para ligar de verdade ao xDrip+, o browser precisa de contactar `127.0.0.1` (o próprio telemóvel), e os browsers modernos (Chrome incluído) **bloqueiam sites públicos de acederem a serviços na tua rede/telemóvel local**, por segurança — não há forma de contornar isto num site público como o github.io.

Por isso, para uso real tens de abrir os ficheiros **localmente**, não pelo link:

1. No telemóvel, abre **github.com/&lt;utilizador&gt;/Glicose** no Chrome
2. Botão verde **"Code"** → **"Download ZIP"**
3. Abre o `.zip` transferido com o gestor de ficheiros e escolhe **"Extrair"**
4. Dentro da pasta extraída, entra em `web/` e toca em `index.html` → abrir com **Chrome**

Podes adicionar essa página aos favoritos ou "Adicionar ao ecrã principal" no Chrome para abrir como se fosse uma app. Sempre que o código for atualizado, repete estes passos para teres a versão nova.

## Como funciona

O xDrip+ tem um serviço web local (compatível com o formato Nightscout) que responde em `http://127.0.0.1:17580/sgv.json` com as últimas leituras. Esta app faz apenas isso: pergunta a esse serviço a cada poucos minutos e organiza a resposta numa tabela e num resumo diário.

## Configurar o xDrip+ (uma vez só)

1. Abre o xDrip+ → menu (☰) → **Settings** → **Inter-app settings**
2. Ativa **"Web Service"**
3. Confirma que a porta está em **17580** (é o valor por omissão)
4. Deixa a palavra-passe da Web Service vazia, a não ser que queiras usar autenticação (ver secção "Definições" abaixo)

## Usar a app

- **Leituras por hora**: tabela com a hora, última leitura, mínimo, máximo e tendência de cada hora. Cores: azul = baixo, verde = normal, vermelho = alto.
- **Resumo**: média, mínimo, máximo e percentagem de tempo no intervalo saudável nas últimas horas (configurável).
- **Refeições**: toca em "+ Registar refeição" para guardar a hora (e opcionalmente descrição/gramas de carboidratos) de uma refeição. A app calcula automaticamente o pico de glicose e a subida (delta) nas horas seguintes, para ajudares a perceber quais refeições causam mais picos. Um ícone 🍽️ aparece na tabela na hora em que registaste a refeição.
- **Leituras antigas (manuais)**: o xDrip+ só regista valores a partir do momento em que ligaste o "Companion App" à LinX — não consegue ir buscar o histórico que a LinX já tinha antes disso. Para preencheres esse período, toca em "+ Adicionar leitura", olha para o valor no gráfico da LinX numa determinada hora, e escreve-o aqui com a data/hora certa. Essas leituras ficam marcadas com ✍️ na tabela e entram nos cálculos de resumo e de picos de refeições tal como as leituras normais.
- **Definições** (ícone de engrenagem): unidades (mg/dL ou mmol/L), limites de hipo/hiperglicemia, quantas horas mostrar, janela de tempo para calcular o pico pós-refeição, e frequência de atualização automática.

As refeições e as leituras manuais ficam guardadas no armazenamento local do browser (não saem do telemóvel). Se limpares os dados do browser (Chrome), perdes esse histórico — o xDrip+ continua a ter os dados dele à parte.

## Resolução de problemas

**"Erro a ligar ao xDrip+: Failed to fetch"**
- Se estiveres a abrir através do link `github.io`: é esperado, os browsers bloqueiam sites públicos de acederem a serviços locais do telemóvel — usa sempre a versão extraída do ZIP (ver secção acima)
- Confirma que o xDrip+ está aberto/a correr em segundo plano
- Confirma que "Web Service" está ativado em Inter-app settings
- Confirma que estás a abrir a página no *mesmo telemóvel* onde o xDrip+ está instalado (o endereço 127.0.0.1 refere-se sempre ao próprio dispositivo)

**Sem leituras / tabela vazia**
- O xDrip+ ainda não tem leituras suficientes das últimas horas configuradas, ou o modo "Companion App" com a LinX não está a funcionar (confirma isso primeiro diretamente no ecrã do xDrip+)

**Colocaste uma palavra-passe na Web Service do xDrip+**
- Introduz a mesma palavra-passe no campo "Palavra-passe da Web Service" nas Definições desta app
