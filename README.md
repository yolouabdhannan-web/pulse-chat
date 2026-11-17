# HECM — messagerie universitaire

Messagerie universitaire à l’identité visuelle verte et blanche : React + Tailwind + Framer Motion côté client, Express + Socket.io + PostgreSQL côté serveur, médias sur disque local ou S3.

## Démarrage rapide (dev)

Prérequis : Node 20+ et PostgreSQL 16+ (serveur local ou distant).

```bash
# Depuis la racine du projet : installe les dépendances des trois packages une première fois
npm install
npm install --prefix server
npm install --prefix client

# Configurez server/.env (DATABASE_URL, JWT_SECRET et ADMIN_PASSWORD), puis lancez API + client
npm run dev                 # http://localhost:5173 et API sur http://localhost:4000
```

Définissez une adresse e-mail et un mot de passe administrateur uniques dans `server/.env` avant de démarrer le serveur; aucun compte admin avec mot de passe prédéfini ne doit être utilisé.

## Démarrage Docker (tout-en-un)

```bash
cp server/.env.example server/.env   # éditez JWT_SECRET et ADMIN_PASSWORD
docker compose up --build            # http://localhost:8080
```

## Déploiement de production (Render)

Le client Vite et l’API Express/Socket.IO sont servis sur la même origine par le conteneur racine. Cette architecture conserve le cookie de session, les connexions WebSocket et les URLs relatives de l’application. Le backend ne doit pas être déployé en fonction serverless Vercel : Socket.IO, la présence en mémoire et la tâche de nettoyage nécessitent un processus Node persistant.

1. Créez une base PostgreSQL managée (PostgreSQL 16 recommandé) et copiez son URL de connexion interne dans la variable Render `DATABASE_URL`.
2. Créez un Web Service Render à partir du dépôt et sélectionnez le Blueprint `render.yaml` à la racine. Le Dockerfile compile le client puis lance Express; `/api/health` sert de contrôle de santé.
3. Renseignez `ADMIN_EMAIL` et un `ADMIN_PASSWORD` unique. `JWT_SECRET` est généré par Render. Ne réutilisez pas le mot de passe de démonstration documenté ci-dessus.
4. Configurez un bucket privé S3 ou compatible (par exemple Cloudflare R2) dans `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID` et `S3_SECRET_ACCESS_KEY`. Le disque local du conteneur n’est pas durable entre les redéploiements; ne mettez pas l’application en production avec le stockage local des médias.
5. Lancez le déploiement depuis Render, puis vérifiez l’URL `https://<service>.onrender.com/api/health`, l’inscription/connexion, les routes React, les médias et une connexion temps réel avant de partager l’URL publique.

Les variables contenant des identifiants doivent être configurées dans le tableau de bord Render et ne doivent jamais être ajoutées au dépôt. Le Blueprint ne crée pas de base ni de bucket et ne déclenche pas de déploiement depuis ce dépôt. Le frontend reste accessible depuis la même URL que l’API, ce qui évite les problèmes de cookies tiers sans domaine personnalisé.

## Stockage S3

Renseignez `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (et `S3_ENDPOINT` pour Cloudflare R2, Backblaze, MinIO…) dans `server/.env`. Sans `S3_BUCKET`, les fichiers sont écrits dans `server/uploads/`. Le bucket doit rester **privé** : l'API redirige vers une URL signée valable 5 min, après contrôle d'authentification.

## Architecture

```
server/src
  index.js            App Express, helmet, CORS, seed admin + suppression du salon « Général »
  db.js               Connexion PostgreSQL et création idempotente du schéma
  socket.js           Auth WebSocket (cookie), présence, messages, « écrit… », lu
  storage.js          Disque local ou S3 (URL signées)
  models/index.js     DTOs et accès utilisateur PostgreSQL
  middleware/auth.js  JWT en cookie httpOnly, requireAuth / requireAdmin
  routes/             auth, chats (DM + groupes), stories, media (upload + fichiers + signalement), admin
client/src
  App.jsx             Table des routes
  routes/guards.jsx   ProtectedRoute, AdminRoute, GuestRoute
  context/            AuthContext (session), ChatContext (Socket.io + état temps réel)
  pages/              Home (accueil public), AuthPage (login/register), Settings, ChatShell, ChatPage, Admin
  components/         ChatList, ChatWindow, MessageBubble, Composer, MediaViewer, Avatar, Aurora
```

## Routes protégées

| Côté | Mécanisme |
|---|---|
| Client | `ProtectedRoute` (connecté), `UserRoute` (chat réservé aux utilisateurs), `AdminRoute` (panneau admin seul) ; `GuestRoute` pour login/register |
| API | `requireAuth + requireUser` sur les chats, stories et uploads ; `requireAuth + requireAdmin` sur `/api/admin/*` |
| WebSocket | `io.use()` refuse les connexions sans cookie JWT valide, celles des admins et celles des comptes bloqués |

Un compte admin arrive directement sur le panneau d’administration ; il n’a pas accès à l’interface de chat et ne peut pas envoyer de messages, publier des stories ou téléverser de fichiers.

Les gardes client améliorent l'expérience ; **la sécurité réelle est côté serveur** (rôle et blocage relus en base à chaque requête, jamais lus dans le token).

## Sécurité intégrée

Les étudiants peuvent modifier leur pseudo, leur photo de profil et leur mot de passe depuis « Paramètres ». Ils peuvent aussi personnaliser l’envoi avec Entrée, la densité et la taille des messages, les notifications bureau et les animations. Ces préférences sont enregistrées sur l’appareil. Les mots de passe sont stockés sous forme de hash non réversible : l’administration ne peut pas consulter les mots de passe existants, mais peut en définir un nouveau depuis la gestion des comptes.

- Mots de passe hachés (bcrypt, coût 12), JWT 7 jours en cookie `httpOnly` + `sameSite=lax` (+ `secure` en production)
- Rate limiting sur l'authentification, `helmet`, validation `zod`, requêtes PostgreSQL paramétrées
- Upload : liste blanche de types MIME, 25 Mo max, nom de stockage aléatoire (UUID), accès aux fichiers réservé aux connectés
- Production : servez le site en HTTPS (indispensable pour le cookie `secure`)

## Appels, groupes et stories

- Les boutons téléphone et caméra apparaissent dans les conversations individuelles. Les appels utilisent WebRTC pair-à-pair et demandent l’accès au micro/de la caméra ; le site doit être servi en HTTPS en production. Un serveur STUN est configuré par défaut. Pour les réseaux qui bloquent les connexions directes, configurez `ICE_SERVERS` dans `server/.env` avec les serveurs ICE/TURN de votre fournisseur ; la configuration est transmise uniquement aux utilisateurs authentifiés.
- La messagerie accepte les photos, vidéos, fichiers ZIP/TXT et autres types autorisés, ainsi que l’enregistrement et la lecture de messages vocaux. Les pièces jointes sont limitées à 25 Mo.
- Les groupes se créent depuis l’icône « groupe » de la liste des discussions en choisissant un nom et des membres.
- Les stories image/vidéo (25 Mo maximum) sont visibles par les utilisateurs avec lesquels il existe une conversation individuelle ou de groupe, et expirent au bout de 24 heures.

Les appels de groupe, les notifications push, le chiffrement de bout en bout et le scan antivirus des uploads restent des évolutions possibles.
