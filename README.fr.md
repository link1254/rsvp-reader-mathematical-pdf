# RSVP Reader - Mathematical PDF

[English](README.md) | **Français**

<p align="center">
  <img src="public/icons/icon-128.png" width="128" height="128" alt="Logo de RSVP Reader - Mathematical PDF">
</p>

Extension de lecture RSVP pour les PDF scientifiques et mathématiques.

Elle lit un passage sélectionné mot par mot dans une fenêtre séparée, détecte
localement les notations mathématiques et les affiche comme des captures fidèles
du PDF. Le document reste ouvert à la même page et aucune annotation n'est
modifiée.

> **Statut : prototype expérimental.** Le projet fonctionne sur le PDF de test
> principal, mais il doit encore être éprouvé sur davantage de documents, de
> systèmes et de navigateurs.

## Pourquoi ce projet ?

Je suis étudiant en physique et dyslexique. J'avais besoin rapidement d'un
outil qui rende les longs textes scientifiques plus faciles à lire sans
détruire les équations lors de l'extraction du texte.

Le projet a donc été développé selon une approche de « vibe coding » : un
développement très itératif avec l'aide d'outils d'IA, des tests automatisés et
de nombreux essais sur de vrais cours de physique. Son code source est public
afin que les personnes qui trouvent l'idée utile puissent tester, corriger et
améliorer l'outil.

## Fonctionnalités

- lecture RSVP du texte sélectionné directement dans le lecteur PDF du
  navigateur, avec vitesse, rythme adaptatif pour les mots difficiles,
  navigation et contexte réglables ;
- détection locale des notations mathématiques, affichées comme des captures
  fidèles du PDF plutôt que comme une transcription incertaine ;
- extraction des numéros d'équation courants comme `(2.4)`, `(A.3a)`, `[4.2]`
  ou un `4.2` aligné à droite : le numéro disparaît du texte RSVP et s'affiche
  dans le coin inférieur droit de l'équation correspondante ;
- pauses contrôlées sur les équations, avec continuation manuelle ou automatique
  et copie de l'image si nécessaire ;
- progression visible pendant l'analyse du PDF et signalement facultatif avec
  vérification des données ;
- polices adaptées à la dyslexie, deux thèmes et fenêtre redimensionnable dont
  le contenu et les dimensions s'adaptent entre les sessions ;
- interfaces française et anglaise, choisies automatiquement selon la langue
  du navigateur ou explicitement dans les réglages ;
- traitement entièrement local : aucun PDF ni extrait n'est envoyé à un serveur.

## Navigateurs

| Navigateur | État | Adresse des extensions |
| --- | --- | --- |
| Microsoft Edge | Pris en charge et utilisé pour les tests principaux | `edge://extensions` |
| Google Chrome | Pris en charge sur Chromium 116 ou plus récent | `chrome://extensions` |
| Brave | Pris en charge sur les versions desktop récentes basées sur Chromium | `brave://extensions` |
| Firefox | Non compatible en l'état | `about:debugging#/runtime/this-firefox` |

Edge, Chrome et Brave utilisent les mêmes API d'extension Chromium. Brave
indique officiellement prendre en charge presque toutes les extensions
compatibles Chromium. Firefox utilise des API différentes pour la barre
latérale et le processus d'arrière-plan ; les détails sont expliqués dans la
section [Compatibilité Firefox](#compatibilité-firefox).

## Installation

### 1. Construire l'extension

Prérequis :

- [Git](https://git-scm.com/) ;
- [Node.js](https://nodejs.org/) 20 ou plus récent ;
- environ 200 Mo d'espace libre pour les dépendances et le modèle local.

```bash
git clone https://github.com/link1254/rsvp-reader-mathematical-pdf.git
cd rsvp-reader-mathematical-pdf
npm install
npm run check
```

La commande `npm run check` exécute les tests puis crée l'extension prête à
charger dans le dossier `dist`.

### 2. Microsoft Edge

1. Ouvrir `edge://extensions`.
2. Activer **Mode développeur**.
3. Cliquer sur **Charger l'extension décompressée**.
4. Sélectionner le dossier `dist`.
5. Ouvrir les détails de l'extension et activer **Autoriser l'accès aux URL de
   fichier** pour lire des PDF enregistrés sur l'ordinateur.

Documentation officielle :
[charger une extension locale dans Edge](https://learn.microsoft.com/en-us/microsoft-edge/extensions/getting-started/extension-sideloading).

### 3. Google Chrome

1. Ouvrir `chrome://extensions`.
2. Activer **Mode développeur**.
3. Cliquer sur **Charger l'extension non empaquetée**.
4. Sélectionner le dossier `dist`.
5. Dans les détails de l'extension, autoriser l'accès aux URL de fichier pour
   les PDF locaux.

Documentation officielle :
[charger une extension non empaquetée dans Chrome](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked).

### 4. Brave

1. Ouvrir `brave://extensions`.
2. Activer **Mode développeur**.
3. Cliquer sur **Charger l'extension non empaquetée**.
4. Sélectionner le dossier `dist`.
5. Autoriser l'accès aux URL de fichier dans les détails de l'extension si
   nécessaire.

Brave repose sur Chromium et
[documente la compatibilité avec les extensions Chromium](https://support.brave.com/hc/en-us/articles/360017909112-How-can-I-add-extensions-to-Brave).

## Utilisation

1. Ouvrir un PDF contenant une couche de texte dans le navigateur.
2. Sélectionner le passage à lire.
3. Faire un clic droit sur la sélection.
4. Choisir **Lire la sélection avec RSVP Reader**.
5. Attendre la fin de l'analyse locale, puis utiliser :
   - `Espace` pour lancer ou mettre en pause ;
   - les flèches gauche et droite pour avancer mot par mot ;
   - la flèche haut ou `↶` pour reprendre la phrase actuelle ;
   - `-5` et `+5` pour se déplacer rapidement ;
   - **J’ai compris — continuer** pour valider une équation ;
   - **Copier l’image** pour copier la formule affichée.
6. Utiliser **Signaler** pour préparer un rapport. L'extrait sélectionné et
   l'image de la page PDF peuvent être retirés séparément avant la copie ou
   l'envoi.
7. Ouvrir **Réglages → Langue de l’interface** pour choisir **Automatique
   (navigateur)**, **Français** ou **English**. Ce choix traduit également le
   menu contextuel.
8. Dans les réglages, activer **Tester les fonctionnalités bêta** pour essayer
   le contexte synchronisé. Désactiver ce réglage restaure immédiatement
   l'affichage stable précédent.

Si une sélection très courte apparaît à plusieurs endroits du document,
l'extension refuse de choisir arbitrairement une page. Sélectionnez alors une
phrase un peu plus longue.

## Fonctionnalités bêta

Les fonctionnalités bêta sont désactivées par défaut. Le premier prototype
affiche la phrase courante dans une zone stable, met en évidence le même mot que
le lecteur RSVP et fait défiler cette zone uniquement lorsque cela est
nécessaire. Les captures d'équations disponibles sont conservées dans ce
contexte. Le mode vertical ou horizontal stable reste mémorisé pendant le test.

## Signalement des problèmes

Par défaut, **Signaler** ouvre une Issue publique préremplie sur le dépôt GitHub
du projet. Rien n'est publié automatiquement : l'utilisateur doit vérifier
l'Issue sur GitHub puis la publier manuellement. La description et les
diagnostics affichés seront publics. L'extrait sélectionné est facultatif et
décoché par défaut ; aucune image de page PDF n'est jointe automatiquement en
mode public.

La fonctionnalité peut changer de mode sans supprimer son code :

```dotenv
# Mode par défaut : Issue GitHub publique préremplie
VITE_FEEDBACK_MODE=public

# Relais Worker privé facultatif
VITE_FEEDBACK_MODE=private
VITE_FEEDBACK_ENDPOINT=https://feedback.example.com/report

# Masquer la fonctionnalité
VITE_FEEDBACK_MODE=disabled
```

Le relais privé facultatif crée une Issue dans un dépôt GitHub privé séparé.
Son installation est documentée dans
[`feedback-relay/README.md`](feedback-relay/README.md).

## Fonctionnement des mathématiques

1. [PDF.js](https://mozilla.github.io/pdf.js/) ouvre le document, lit sa couche
   de texte et rend la page en image.
2. Le modèle local
   [Pix2Text MFD 1.5](https://huggingface.co/breezedeus/pix2text-mfd-1.5)
   détecte les régions mathématiques dans l'image.
3. [ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/) exécute le
   modèle directement dans l'extension.
4. La géométrie de la couche PDF associe la sélection et les régions détectées.
5. Les formules sont recadrées dans le rendu original et deviennent des étapes
   RSVP sous forme d'images PNG.

Le PDF n'est pas converti en Markdown : les balises mathématiques du Markdown
seraient générées après reconnaissance, et non récupérées de manière fiable
dans le PDF original. Le modèle embarqué détecte seulement les régions
mathématiques ; l'extension affiche donc des captures exactes plutôt qu'un
LaTeX potentiellement faux.

Une description technique plus détaillée est disponible dans
[`PDF_MATH_DETECTION.md`](PDF_MATH_DETECTION.md).

## Vie privée et permissions

La lecture et l'analyse mathématique sont entièrement locales :

- aucun compte n'est nécessaire ;
- aucune télémétrie n'est intégrée ;
- le PDF, le texte sélectionné et les captures ne sont pas envoyés sur Internet
  pendant la lecture ;
- le modèle ONNX et le moteur WebAssembly sont inclus dans l'extension.

En mode public, l'extension ouvre seulement une page GitHub préremplie après
confirmation. L'utilisateur contrôle encore la publication finale sur GitHub.
L'extrait est facultatif et l'image de la page n'est jamais incluse
automatiquement. En mode privé, les données sont envoyées au relais configuré
uniquement après validation ; l'extrait et l'image complète disposent de
consentements séparés.

Les permissions servent à créer le menu contextuel, lire l'onglet actif,
capturer visuellement la page, ouvrir et mémoriser la fenêtre RSVP, conserver
les réglages et copier une équation dans le presse-papiers. Les autorisations
`file://`, `http://` et `https://` permettent d'accéder au PDF sélectionné.

## Compatibilité Firefox

Le code ne peut pas être chargé tel quel dans Firefox.

- Chromium utilise `sidePanel`, tandis que Firefox utilise
  [`sidebar_action`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/sidebar_action).
- Le manifeste actuel déclare un
  [`background.service_worker`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background),
  qui n'est pas pris en charge de la même manière par Firefox.
- Le manifeste contient aussi des champs et permissions propres à Chromium.
- Le comportement du lecteur PDF intégré, de la capture d'onglet et de la copie
  d'image doit être validé séparément.

Un portage propre demandera un manifeste Firefox généré séparément, un adaptateur
pour la barre latérale et une campagne de tests dédiée. Une grande partie du
moteur PDF et de la détection mathématique pourra néanmoins être réutilisée.

## Développement

```bash
npm install
npm run dev
npm run test
npm run build
npm run check
```

- `npm run dev` démarre Vite pour le développement de l'interface.
- `npm run test` exécute la suite Vitest.
- `npm run build` reconstruit `dist`.
- `npm run check` exécute les tests puis la compilation complète.

Après une modification, reconstruire l'extension, cliquer sur **Recharger** dans
la page des extensions et fermer toute ancienne fenêtre RSVP encore ouverte.

## Contribuer

Les retours, issues et pull requests sont bienvenus, en particulier pour :

- tester d'autres PDF scientifiques ;
- réduire les faux positifs et les formules manquées ;
- améliorer l'accessibilité et l'expérience de lecture ;
- mesurer les performances sur d'autres machines ;
- préparer le portage Firefox ;
- ajouter des tests reproductibles.

Pour signaler un problème, indiquez si possible le navigateur et sa version, la
version de l'extension, le type de PDF, le numéro de page, la sélection utilisée
et une capture d'écran. Ne publiez pas un PDF protégé par le droit d'auteur sans
autorisation.

Avant une pull request :

```bash
npm run check
```

## Technologies, sources et crédits

- [Mozilla PDF.js](https://github.com/mozilla/pdf.js) : lecture de la couche
  texte et rendu des pages PDF, licence Apache-2.0.
- [Pix2Text](https://github.com/breezedeus/Pix2Text) et
  [Pix2Text MFD 1.5](https://huggingface.co/breezedeus/pix2text-mfd-1.5) :
  détection des formules mathématiques, licence MIT.
- [Microsoft ONNX Runtime Web](https://github.com/microsoft/onnxruntime) :
  inférence locale du modèle, licence MIT.
- [KaTeX](https://katex.org/) : outils de rendu mathématique, licence MIT.
- [Atkinson Hyperlegible](https://fontsource.org/fonts/atkinson-hyperlegible),
  [OpenDyslexic](https://fontsource.org/fonts/opendyslexic) et
  [Lexend](https://fontsource.org/fonts/lexend) : polices de lecture embarquées
  localement, licence SIL Open Font License 1.1.
- [Vite](https://vite.dev/) : compilation de l'extension, licence MIT.
- [Vitest](https://vitest.dev/) : tests automatisés, licence MIT.
- [OpenAI Codex](https://help.openai.com/en/articles/11369540/) : assistance au
  développement, à la revue du code et à la création des tests.
- [Documentation Chromium Extensions](https://developer.chrome.com/docs/extensions/)
  et [MDN WebExtensions](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions) :
  références pour les API de navigateur.

Les fichiers exacts du modèle et du moteur embarqués, leurs versions, licences
et empreintes SHA-256 sont documentés dans
[`public/models/README.md`](public/models/README.md).
L'inventaire complet des attributions et les chemins vers les textes de licence
se trouvent dans
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md). `npm run check` vérifie
que ces mentions correspondent toujours aux dépendances installées et aux
fichiers de modèle distribués.

Le PDF de cours utilisé pendant le développement n'est pas inclus dans ce dépôt.

## Licence

Le code et les ressources originales du projet sont disponibles sous la
[licence PolyForm Noncommercial 1.0.0](LICENSE). Les usages personnels,
scientifiques, éducatifs, d'intérêt public et les autres usages non commerciaux
autorisés sont décrits dans la licence.

Toute utilisation commerciale, vente, distribution monétisée ou intégration
dans un produit commercial nécessite une licence écrite distincte accordée par
le titulaire des droits. Les demandes de licence commerciale peuvent être
adressées au propriétaire du dépôt sur GitHub.

Le nom et le logo identifient ce projet et ne sont pas concédés pour un usage
suggérant un soutien ou une version dérivée officielle. Les composants et
modèles d'autres auteurs restent soumis aux licences indiquées dans
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
