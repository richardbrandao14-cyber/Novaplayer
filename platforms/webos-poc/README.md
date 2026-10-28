# NEX TV — prova de conceito webOS

Alvo informado: LG UM7510PSB, firmware 05.40.97. Firmware não é a versão webOS; compatibilidade só será confirmada na TV. Este é um aplicativo de teste separado do NEX Windows, não a edição completa para TV.

Inclui navegação por setas/OK/Voltar, vídeo sintético H.264/AAC embutido, amostra HLS local, URL direta e fluxo Xtream para escolher canal, filme, série/episódio. Catálogo limitado a 40 registros por resposta (8 MB/25 s). Sem proxy, DRM, transcodificação, libmpv ou credenciais embutidas. Não muda o endereço .ts para .m3u8 automaticamente: formato de TV é uma escolha explícita e precisa existir no servidor.

## Instalação na TV — sem programação

1. Na LG, abra **LG Content Store**, procure **Developer Mode** e instale o app publicado pela **LG Electronics**. A disponibilidade pode variar conforme a região/loja.
2. No computador, crie/ative uma conta de desenvolvedor LG em https://webostv.developer.lge.com/ e aceite os termos necessários. Entre com essa conta no Developer Mode da TV.
3. Ative **Dev Mode Status** e aceite reiniciar a TV. Reabra Developer Mode e ative **Key Server**.
4. Deixe computador e TV na mesma rede. Anote o endereço IP e a passphrase mostrados pela TV **apenas para inserir no seu computador**. Não os publique nem envie senhas no chat.
5. No Windows, obtenha o **webOS Dev Manager** em https://github.com/webosbrew/dev-manager-desktop/releases/latest. É uma ferramenta comunitária, não um aplicativo oficial da LG. Escolha o instalador Windows x64 `.msi`.
6. Abra o gerenciador e adicione a TV em **Developer Mode**, usando o IP e a passphrase da tela da TV. O perfil de desenvolvimento normalmente usa SSH porta 9922; o gerenciador orienta os campos.
7. Na área de aplicativos do gerenciador, use **Install** e selecione `com.nex.poc.webos_0.1.1_all.ipk` deste pacote.
8. Abra **NEX TV · Teste** pela TV ou pelo gerenciador. Não abra o `.ipk` como executável Windows e não use pen drive como instalador genérico.

Developer Mode é temporário e exige atenção à sessão/renovação indicada na própria TV. Não fixamos duração em horas: conferir o comportamento atual no aparelho. Não é o fluxo de distribuição comercial definitiva.

## Ordem dos testes

- Use volume baixo. Selecione **Testar vídeo e som**: deve aparecer imagem sintética com um tom de áudio. A amostra é sintética em 1280×720, H.264 Constrained Baseline e AAC-LC estéreo 48 kHz; não é uma obra real.
- Pause/reproduza e use **Voltar**. O foco deve retornar ao botão anterior.
- Experimente **Testar HLS local**. Falha nesse arquivo local, isoladamente, não determina se HLS da Internet funciona.
- Conecte sua fonte Xtream diretamente na TV ou informe uma URL autorizada. Teste um canal, um filme e um episódio. Selecione **Imagem e som OK** somente quando você confirmar ambos.
- Ao acabar, use **Limpar dados**. O app não grava credenciais, histórico ou confirmações em armazenamento permanente. Dados existem em memória até limpar/encerrar a sessão. Colocar o app em segundo plano pausa o vídeo; encerrar remove o estado.
- Relate apenas: tipo de teste, imagem/som, mensagem genérica e comportamento do controle. Não envie URL completa, senha ou token.

Consultas diretas podem ser bloqueadas por CORS, TLS ou particularidades do provedor. Codecs/áudio/HLS precisam ser testados no modelo real. Nenhum servidor intermediário foi contratado ou ativado.

## Build reproduzível

Na raiz deste repositório, com Node 24:

```sh
npm --prefix platforms/webos-poc ci --ignore-scripts
npm --prefix platforms/webos-poc test
npm --prefix platforms/webos-poc run build
```

CLI oficial LG `@webos-tools/cli` 3.2.6 fixada em package-lock.json, sem execução de scripts de instalação. O estado da CLI é isolado em node_modules/.nex-cli-state usando APPDATA apenas no processo filho; HOME/USERPROFILE/perfil do usuário não são alterados. App usa JS de sintaxe ES5 e APIs de mídia web; não leva dependências npm para a TV. A pasta dist contém `.ipk` e SHA256SUMS.txt. A ferramenta oficial só é usada no empacotamento, não é incorporada ao app.

Smoke de navegador, após `npm ci` na raiz (ferramenta Playwright já usada pelo projeto) e build acima:

```sh
NOVA_CHROMIUM_PATH=/usr/bin/chromium node platforms/webos-poc/scripts/smoke.cjs
```

O smoke verifica decodificação MP4 no Chromium, pausa/retorno/foco, catálogo e três tipos de reprodução com servidor simulado, campos limpos e ausência de storage persistente. Isso NÃO verifica áudio audível, CORS do provedor, HLS nem execução no webOS. A prova só estará concluída após teste físico na LG.

A edição Windows e suas alterações em andamento permanecem separadas. Não há publicação na loja, instalador comercial ou adaptação completa da biblioteca NEX nesta entrega.


## Revisão 0.1.1 — inicialização e diagnóstico

O proprietário relatou tela preta, botões sem visual e teste local sem resposta na LG. A causa exata ainda não foi confirmada no aparelho. O teste anterior verificava somente a origem HTTP no Chromium; uma tentativa file:// neste ambiente foi bloqueada pela política do navegador.

Mitigação: o empacotador embute CSS e os três scripts no HTML, com CSP SHA-256 (sem unsafe-inline/unsafe-eval ou JavaScript remoto). As referências a arquivos CSS/JS são eliminadas do pacote; mídia local permite file: explicitamente. Exportação do domínio prefere window, sem depender de this/module do runtime. Indicador de versão/inicialização distingue scripts e estilo; erros só mostram linha numérica, nunca URL/token. Reprodução tem timeout de diagnóstico de 12 s. O OK do controle recebe tratamento explícito por keydown, sem depender do clique automático do navegador. A amostra local foi substituída por referência HD adequada a decoders de TV; isso não prova suporte deste modelo.

Regressão: com CSS/JS externos bloqueados, o pacote 0.1.0 falhou em iniciar; o pacote 0.1.1 iniciou, confirmou estilo e reproduziu MP4 no Chromium. Isso verifica a mitigação, não estabelece que essa foi a única causa na LG. Ao atualizar, feche o aplicativo antes de instalar o .ipk 0.1.1. Ao abrir, confirme “Versão 0.1.1 · JavaScript OK · Estilo OK”.
