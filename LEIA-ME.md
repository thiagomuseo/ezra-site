# Site do Ezra Adler-Wright: como publicar

O site usa três serviços gratuitos:

- **Supabase**: guarda o login, as tramas, os textos editados, a meta, o registro de cenas e as fotos.
- **GitHub**: guarda os arquivos do site.
- **Vercel**: publica o site e gera o link para compartilhar.

Faça os passos no computador. O celular atrapalha na hora de subir a pasta.

## Parte 1. Supabase (banco e login)

1. Entre em supabase.com, crie uma conta e clique em **New project**.
   Dê um nome (ex.: `ezra-site`), escolha a região **South America (São Paulo)** e gere uma senha forte para o banco. Guarde essa senha num gerenciador de senhas.
2. Com o projeto pronto, abra **SQL Editor**, clique em **New query**, cole todo o conteúdo de `supabase/setup.sql` e clique em **Run**.
   Isso cria as tabelas, as regras de acesso e o espaço das fotos.
3. Vá em **Authentication**, depois em **Sign In / Providers** (em versões antigas, **Providers > Email**) e **desligue** a opção que permite novos cadastros (**Allow new users to sign up**). Salve.
   A partir daqui ninguém consegue criar conta no seu projeto.
4. Ainda em **Authentication**, abra **Users**, clique em **Add user > Create new user**, coloque o seu e-mail e uma senha forte (16 caracteres ou mais) e marque **Auto Confirm User**.
5. Volte ao **SQL Editor** e rode só esta linha, trocando pelo seu e-mail:

   ```sql
   insert into public.site_owner (user_id) select id from auth.users where email = 'seu@email.com';
   ```

   Isso marca a sua conta como a única dona do site.
6. Abra **Project Settings > API** (em versões novas, **Data API** e **API Keys**) e copie:
   - a **Project URL** (algo como `https://abcdxyz.supabase.co`);
   - a chave **anon** / **publishable**.

   Não copie a chave **service_role** / **secret**. Ela nunca vai no site.

## Parte 2. GitHub (arquivos do site)

7. Entre em github.com, crie uma conta e clique em **New repository**.
   Nome: `ezra-site`. Pode deixar **Private**. Clique em **Create repository**.
8. Na página do repositório, clique em **uploading an existing file** (ou **Add file > Upload files**).
   Descompacte o .zip no computador, abra a pasta `ezra-site` e arraste **o conteúdo dela** (index.html, as pastas css, js, img, supabase e os outros arquivos) para a página. Clique em **Commit changes**.
9. No repositório, abra `js/config.js`, clique no lápis (**Edit**), troque o endereço `https://SEU-PROJETO.supabase.co` e o texto `COLE_AQUI_A_CHAVE_ANON` pelo que você copiou no passo 6 e clique em **Commit changes**.

## Parte 3. Vercel (link público)

10. Entre em vercel.com com **Continue with GitHub**.
11. Clique em **Add New > Project**, autorize o acesso ao repositório `ezra-site` e clique em **Import**.
12. Em **Framework Preset**, escolha **Other**. Não preencha nada de build. Clique em **Deploy**.
13. Para mudar o link, vá em **Settings > Domains** e edite o endereço (ex.: `ezra-adler-wright.vercel.app`).
14. Volte ao Supabase, abra **Authentication > URL Configuration** e coloque o link da Vercel em **Site URL**. Salve.

## Parte 4. Teste

15. Abra o link, role até o rodapé e toque em **Área do player**. Entre com o e-mail e a senha do passo 4.
    A aba **Painel** deve aparecer, junto com os botões de edição.
16. Abra o mesmo link numa aba anônima. Ali não pode aparecer nem o Painel nem nenhum botão de edição.

Sempre que você mudar um arquivo no GitHub, a Vercel publica a nova versão sozinha em menos de um minuto.

## O que protege o site

- Só existe uma conta, a sua, e novos cadastros estão desligados.
- As regras do banco deixam só a conta marcada como dona gravar, alterar ou apagar qualquer coisa. Isso vale mesmo para quem tentar mexer pelo código do navegador.
- O registro de cenas só pode ser lido pela sua conta. Para os visitantes ele não existe.
- As fotos aceitam só imagens de até 5 MB, e só a sua conta envia ou apaga.
- O site bloqueia scripts de fora, não pode ser aberto dentro de outros sites e só funciona com HTTPS.
- O site pede para não aparecer no Google.
- Depois de muitas tentativas de senha erradas, o Supabase bloqueia por um tempo.

Para fechar mais ainda:

- Ative a verificação em duas etapas nas contas do GitHub, da Vercel e do Supabase.
- Guarde a senha do site num gerenciador de senhas e não use a mesma em outro lugar.
- Nunca coloque a chave **service_role** / **secret** em nenhum arquivo do site.
