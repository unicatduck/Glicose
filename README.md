# Glicose Hora a Hora

App web simples que lê os valores de glicose do **xDrip+** (que já está a receber os dados da LinX/Aidex X) e mostra-os de forma clara, hora a hora, em vez do gráfico. Também permite registar refeições e ver o pico de glicose e a subida (delta) provocados por cada uma.

Não precisa de instalação, servidor, nem conta na cloud — são 3 ficheiros estáticos (`web/index.html`, `web/style.css`, `web/app.js`) que correm diretamente no browser do telemóvel.

## Como funciona

O xDrip+ tem um serviço web local (compatível com o formato Nightscout) que responde em `http://127.0.0.1:17580/sgv.json` com as últimas leituras. Esta app faz apenas isso: pergunta a esse serviço a cada poucos minutos e organiza a resposta numa tabela e num resumo diário.

## Configurar o xDrip+ (uma vez só)

1. Abre o xDrip+ → menu (☰) → **Settings** → **Inter-app settings**
2. Ativa **"Web Service"**
3. Confirma que a porta está em **17580** (é o valor por omissão)
4. Deixa a palavra-passe da Web Service vazia, a não ser que queiras usar autenticação (ver secção "Definições" abaixo)

## Abrir a app no telemóvel

1. Copia a pasta `web/` para o telemóvel (ex: por email, Google Drive, cabo USB)
2. No gestor de ficheiros do telemóvel, toca em `web/index.html` e escolhe abrir com o **Chrome**
3. A app deve mostrar automaticamente as leituras do xDrip+. Se aparecer uma mensagem de erro na barra superior, lê a secção "Resolução de problemas" abaixo

Dica: podes adicionar a página aos favoritos ou "Adicionar ao ecrã principal" no Chrome para abrir como se fosse uma app.

## Usar a app

- **Leituras por hora**: tabela com a hora, última leitura, mínimo, máximo e tendência de cada hora. Cores: azul = baixo, verde = normal, vermelho = alto.
- **Resumo**: média, mínimo, máximo e percentagem de tempo no intervalo saudável nas últimas horas (configurável).
- **Refeições**: toca em "+ Registar refeição" para guardar a hora (e opcionalmente descrição/gramas de carboidratos) de uma refeição. A app calcula automaticamente o pico de glicose e a subida (delta) nas horas seguintes, para ajudares a perceber quais refeições causam mais picos. Um ícone 🍽️ aparece na tabela na hora em que registaste a refeição.
- **Leituras antigas (manuais)**: o xDrip+ só regista valores a partir do momento em que ligaste o "Companion App" à LinX — não consegue ir buscar o histórico que a LinX já tinha antes disso. Para preencheres esse período, toca em "+ Adicionar leitura", olha para o valor no gráfico da LinX numa determinada hora, e escreve-o aqui com a data/hora certa. Essas leituras ficam marcadas com ✍️ na tabela e entram nos cálculos de resumo e de picos de refeições tal como as leituras normais.
- **Definições** (ícone de engrenagem): unidades (mg/dL ou mmol/L), limites de hipo/hiperglicemia, quantas horas mostrar, janela de tempo para calcular o pico pós-refeição, e frequência de atualização automática.

As refeições e as leituras manuais ficam guardadas no armazenamento local do browser (não saem do telemóvel). Se limpares os dados do browser (Chrome), perdes esse histórico — o xDrip+ continua a ter os dados dele à parte.

## Resolução de problemas

**"Erro a ligar ao xDrip+: Failed to fetch"**
- Confirma que o xDrip+ está aberto/a correr em segundo plano
- Confirma que "Web Service" está ativado em Inter-app settings
- Confirma que estás a abrir a página no *mesmo telemóvel* onde o xDrip+ está instalado (o endereço 127.0.0.1 refere-se sempre ao próprio dispositivo)

**Sem leituras / tabela vazia**
- O xDrip+ ainda não tem leituras suficientes das últimas horas configuradas, ou o modo "Companion App" com a LinX não está a funcionar (confirma isso primeiro diretamente no ecrã do xDrip+)

**Colocaste uma palavra-passe na Web Service do xDrip+**
- Introduz a mesma palavra-passe no campo "Palavra-passe da Web Service" nas Definições desta app
