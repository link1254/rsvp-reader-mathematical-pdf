# Reprise du projet RSVP Reader Beta - Mathematical PDF

Dernière version préparée : **1.1.0-beta.1** — 31 juillet 2026.

## Objectif du projet

Créer une extension Microsoft Edge de lecture RSVP pour les PDF scientifiques.
L'utilisateur sélectionne un passage dans le lecteur PDF d'Edge, puis choisit
**Lire la sélection avec RSVP Reader Beta** dans le menu contextuel. Une fenêtre
horizontale reste au-dessus du PDF et affiche le mot courant, son contexte et
l'aperçu du passage.

Toutes les notations mathématiques, en ligne ou affichées, doivent être
présentées comme des captures fidèles du PDF et traitées comme des étapes de
lecture. L'utilisateur peut choisir de continuer automatiquement ou de valider
avec **J'ai compris — continuer**.

## État actuel

- Version de l'extension : `1.1.0-beta.1`.
- La compilation de production est dans le dossier `dist`.
- L'archive `1.1.0-beta.1` n'a pas encore été générée.
- Les 209 tests automatisés passent.
- Le PDF de validation utilisé est le cours
  `[Riccardo Rattazzi - EPFL] NewQFTLectureNotes_08_2024.pdf`.
- Les pages PDF 9 à 11, la page PDF 22 (page imprimée 21), la page PDF 66
  (page imprimée 65) et la page PDF 79 (page imprimée 78) ont servi de cas de
  validation réel.

## Architecture mathématique de la version 0.14.0

1. La page PDF est rendue en bitmap avec PDF.js.
2. Pix2Text MFD 1.5 détecte localement les formules en ligne et affichées.
3. Le seuil de confiance automatique est `0.8`.
4. La couche texte et les numéros comme `(1.4)` servent uniquement à associer
   une étape RSVP à une boîte visuelle. Ils ne définissent plus le recadrage.
5. La formule affichée est une capture directe de la boîte détectée. Elle n'est
   jamais reconstruite depuis le texte copié par Edge.
6. Une association ambiguë est refusée et conserve la capture manuelle.
7. Le modèle ONNX de 80 Mo et ONNX Runtime WebAssembly sont embarqués dans
   `public/models`; l'analyse reste hors ligne.
8. Le chargement du modèle a été validé en Node.js et dans Edge. Sur la page 9,
   l'inférence CPU prend environ 4 à 5 secondes.

Les raisons techniques et la stratégie générale sont détaillées dans
`PDF_MATH_DETECTION.md`.

## Flux RSVP visuel de la version 0.15.0

1. La sélection copiée sert uniquement à retrouver sa page et ses bornes dans
   la couche PDF.
2. Toutes les boîtes mathématiques détectées qui croisent la sélection deviennent
   des étapes RSVP avec une capture.
3. Les glyphes couverts par ces boîtes sont retirés du texte. Les lettres
   grecques, intégrales, racines, indices et exposants ne sont donc plus lus
   comme du texte endommagé.
4. Le découpage fonctionne à l'intérieur d'un même fragment PDF : une formule,
   le mot `with`, puis une seconde formule produisent image, texte, image.
5. Toute notation textuelle résiduelle est masquée si aucune image sûre ne lui
   correspond.
6. Sur la page imprimée 65, les 29 régions détectées ne laissent aucun symbole
   mathématique dans le flux textuel. Le cas signalé a été validé dans Edge avec
   deux images et zéro notation non résolue.

## Corrections de la version 0.15.1

1. Les renvois en prose comme `eqs (4.99)` et `eq. (4.95)` ne sont plus
   classés comme des formules sans image.
2. L'association entre glyphes et régions mathématiques utilise maintenant la
   ligne de base PDF. Les indices et exposants restent dans la formule, sans que
   la région puisse absorber des mots de la ligne voisine.
3. Le rendu PDF analysé est conservé comme source de la capture manuelle. Le
   bouton **Encadrer la formule** ouvre directement l'éditeur lorsqu'une
   notation reste non résolue.
4. **J'ai compris — continuer** devient **Terminer** sur la dernière formule et
   referme correctement la sélection.
5. La page PDF 79 a été validée dans Edge avec 24 captures, aucune notation non
   résolue, aucun mot de prose perdu et aucune erreur d'interface.

## Corrections de la version 0.15.2

1. La recherche ne prend plus la première page dont seuls les mots d'ouverture
   et de fermeture ressemblent à la sélection. Elle compare le contenu
   intérieur de tous les candidats et retient uniquement une correspondance
   nettement meilleure que les autres.
2. Une correspondance ambiguë est refusée avec un message explicite au lieu de
   commencer la lecture plusieurs chapitres plus loin.
3. Une nouvelle sélection annule immédiatement la recherche précédente. Les
   inférences ONNX sont sérialisées afin que deux analyses ne puissent pas
   utiliser simultanément la même session.
4. Les documents PDF et les tenseurs ONNX sont libérés après chaque analyse,
   ce qui évite l'accumulation de mémoire lors de lectures successives.
5. Le début de `4.2.2` sur la page PDF 73 (page imprimée 72) a été validé dans
   Edge avec 8 captures. Un extrait mathématique dégradé de la page PDF 120 a
   également été retrouvé sur la bonne page avec 16 captures.

## Corrections de la version 0.15.3

1. Le détecteur utilise désormais deux seuils. Les régions de confiance
   supérieure à `0.8` restent automatiques ; celles entre `0.4` et `0.8` sont
   conservées uniquement si la couche PDF confirme un glyphe mathématique, une
   police distincte ou une géométrie d'indice/exposant.
2. Cette confirmation récupère les très petites notations en ligne que le
   modèle voit avec une confiance faible, sans transformer les mots italiques
   ordinaires en formules.
3. Une boîte faible qui englobe plusieurs boîtes plus précises est supprimée,
   afin qu'une paire de notations ne produise pas une troisième pause en double.
4. Le passage de la page PDF 18 (page imprimée 17) produit exactement quatre
   captures pour `q_a`, `p_a`, `q̂_a` et `p̂_a`. Aucun de ces glyphes ne reste
   dans le texte RSVP.
5. Le passage italique contenant « a field » sur la page PDF 9 reste du texte
   ordinaire avec zéro notation détectée.

## Interface de la version 0.15.4

1. La fenêtre RSVP s'ouvre par défaut en `1000 × 620`, dans la limite de
   l'espace disponible.
2. La fenêtre reste librement redimensionnable.
3. Chaque redimensionnement enregistre sa largeur et sa hauteur dans le stockage
   local de l'extension. Ces dimensions sont réutilisées à l'ouverture suivante.
4. La position n'est pas mémorisée : la fenêtre est recentrée pour rester
   visible après un changement d'écran.

## Interface de la version 0.15.5

1. Le modèle MFD local détecte les régions mathématiques, mais ne transcrit pas
   leur contenu en LaTeX.
2. Une équation disposant d'une capture PDF affiche désormais le bouton
   **Copier l'image**.
3. Le bouton écrit la capture PNG dans le presse-papiers système. Il n'apparaît
   pas lorsqu'aucune image fiable n'est disponible.

## Interface de la version 0.15.6

1. L'écran d'analyse affiche une barre de progression et l'étape en cours.
2. Le parcours des pages utilise un pourcentage réel calculé sur le nombre de
   pages examinées.
3. Le chargement du modèle et l'inférence ONNX utilisent une barre indéterminée
   animée, car le moteur ne fournit pas de pourcentage interne fiable.
4. Les étapes de rendu, vérification des régions et préparation de la lecture
   sont signalées séparément.

## Documentation et renommage de la version 0.15.7

1. La branche de test et son extension portent le nom
   **RSVP Reader Beta - Mathematical PDF**. La branche `main` conserve le nom
   stable sans la mention Beta.
2. Le slug GitHub prévu est `rsvp-reader-mathematical-pdf`.
3. Le README documente l'installation sur Edge, Chrome et Brave, les limites
   Firefox, la vie privée, les contributions et les sources des composants.
4. Le projet est distribué sous licence PolyForm Noncommercial 1.0.0.

## Identité visuelle de la version 0.15.8

1. Le logo fourni par l'auteur est décliné en PNG de `16`, `32`, `48` et
   `128` pixels.
2. Le manifeste utilise ces fichiers pour l'icône générale de l'extension,
   l'entrée du menu contextuel, la barre d'outils et la page des extensions.
3. Le logo est également affiché en tête du README GitHub.

## Documentation et interface bilingues

1. `README.md` est désormais la page GitHub anglaise par défaut.
2. `README.fr.md` conserve la documentation française complète.
3. Les deux documents proposent un lien de changement de langue en haut de page.
4. L'interface, les messages dynamiques, les rapports et le menu contextuel
   sont disponibles en français et en anglais.
5. Le réglage **Langue de l'interface / Interface language** propose le choix
   automatique selon Edge, le français ou l'anglais.
6. Le manifeste fournit les métadonnées localisées dans `_locales/fr` et
   `_locales/en`.

## Numérotation des équations de la version 1.0.0

1. Les numéros d'équation ne sont plus lus comme des mots RSVP.
2. Les formats `(1)`, `(2.4)`, `(2.4a)`, `(A.3)`, `(A3)`, `(IV.2)`, `[4.2]`
   et les numéros nus placés à droite d'une équation affichée sont reconnus.
3. Le numéro reconnu est associé à la capture correspondante et affiché dans
   son coin inférieur droit.
4. Les références ordinaires présentes dans le texte ne sont pas supprimées.

## Conformité des licences de la version 0.15.10

1. `THIRD_PARTY_NOTICES.md` inventorie les composants distribués, le modèle
   local et les outils de développement avec leurs versions et leurs sources.
2. Les textes de licence de PDF.js, ONNX Runtime Web, Pix2Text MFD et KaTeX
   sont conservés dans `public/licenses` puis copiés dans `dist/licenses`.
3. L'avis tiers complet fourni par ONNX Runtime 1.22.0 est inclus dans le paquet.
4. `LICENSE` et `THIRD_PARTY_NOTICES.md` sont copiés à la racine de `dist`.
5. `npm run license:check` contrôle les licences déclarées, les versions
   documentées, les fichiers distribués et les empreintes du modèle et du
   moteur ONNX.
6. Le build génère `dist/BUNDLED_DEPENDENCIES.json` depuis les modules
   réellement embarqués ; l'audit refuse toute nouvelle dépendance de
   production non documentée ou toute licence npm inattendue.

## Présentation du projet de la version 0.15.11

1. Les README anglais et français ne qualifient plus l'auteur de « vibe coder ».
2. Ils indiquent clairement que le projet lui-même a été développé selon une
   approche de vibe coding, avec assistance par IA, tests et essais réels.

## Explication des équations de la version 0.15.12

1. Les README résument le flux PDF.js, détection locale, association géométrique
   et capture fidèle des régions mathématiques.
2. Ils précisent que le PDF n'est pas converti en Markdown : les balises et le
   LaTeX seraient reconstruits après reconnaissance et pourraient être faux.

## Polices de lecture de la version 0.15.13

1. Les réglages proposent système, Atkinson Hyperlegible, OpenDyslexic, Lexend
   et un style LaTeX basé sur `KaTeX_Main`.
2. La police choisie s'applique aux mots, au contexte et à l'aperçu du passage,
   mais jamais aux captures fidèles des équations.
3. Le choix est enregistré dans `chrome.storage.local` et restauré au prochain
   lancement.
4. Les polices sont embarquées localement et leurs licences OFL 1.1 sont
   incluses dans `public/licenses` et `dist/licenses`.

## Localisation des sélections de la version 0.15.14

1. Une sélection longue reste localisable lorsque le lecteur PDF omet une
   équation ou réordonne ses glyphes dans le texte transmis à l'extension.
2. Une ancre de prose fixe le début, puis un alignement ordonné de tous les mots
   retrouve la fin malgré les différences mathématiques intermédiaires.
3. Les candidats qui se recouvrent presque entièrement sont traités comme une
   même plage, pas comme une ambiguïté.
4. Le seuil de couverture élevé et la comparaison de toutes les pages restent
   obligatoires. Sur le passage de la section 2.4, seule la page PDF 22 est
   retenue parmi les 294 pages.

## Thème minimal de la version 0.15.15

1. Les réglages proposent les thèmes `Classique` et `Minimal`.
2. Le thème minimal conserve la disposition mais utilise des fonds unis, des
   angles de `2px`, des bordures nettes et aucune ombre décorative.
3. Le bouton Lecture reste circulaire car sa forme identifie directement le
   contrôle principal.
4. Le choix est appliqué immédiatement, enregistré dans `chrome.storage.local`
   et restauré aux utilisations suivantes.

## Thème Eliot de la version 1.0.0

1. Les réglages proposent aussi le thème clair `Eliot`.
2. La palette emploie un fond gris perle, des surfaces blanches non agressives,
   un texte anthracite et des accents rose sakura.
3. Les équations, l’aperçu du passage, les réglages et les fenêtres de dialogue
   disposent de variantes claires cohérentes, sans changer leur disposition.
4. Le choix utilise la même préférence persistante que les thèmes `Classique`
   et `Minimal`.

## Images d’équation haute résolution de la version 1.0.0

1. La détection reste effectuée sur le rendu PDF historique à l’échelle `2`.
2. Après validation des régions, la page est rendue une seconde fois avec
   jusqu’à deux fois plus de pixels par axe pour produire les captures.
3. Les coordonnées et les marges détectées sont simplement mises à l’échelle :
   aucune règle de détection ou d’association des numéros n’est modifiée.
4. La taille visuelle est conservée grâce au facteur de densité de l’image.
5. Le rendu est limité à `16 000 000` pixels et revient automatiquement à la
   capture historique si le rendu haute résolution échoue.

## Contexte de lecture sans libellé mathématique

1. Les éléments de type `equation` restent visibles dans l’aperçu du passage.
2. Les libellés `Notation mathématique` et `Équation` ne sont plus affichés
   parmi les mots voisins à gauche ou à droite du mot actif.
3. Ils sont également retirés de la phrase affichée au bas de la grande zone
   de lecture.
4. Le lecteur continue après une équation pour récupérer le nombre de vrais
   mots demandé dans le réglage du contexte.

## Sélections sans espaces de la version 0.15.16

1. Certains passages transmis par Edge concatènent presque tous les mots, par
   exemple `Itshouldbeappreciatedthattheleastaction...`.
2. Si les associations exacte et par mots échouent, une longue ancre de
   caractères normalisés localise le passage sans dépendre des espaces.
3. Un alignement global tolère ensuite les glyphes mathématiques réordonnés,
   avec une couverture minimale de `64 %` pour les longues sélections.
4. La sélection réelle de la page PDF 21 obtient `99,3 %` de couverture ; cette
   page est l'unique candidate parmi les 294 pages du document.

## Contrôles de lecture de la version 0.15.17

1. Une nouvelle sélection s'ouvre toujours en pause ; aucun minuteur ne lance
   automatiquement la lecture après le chargement.
2. Sur une équation en validation manuelle, le bouton Lecture et la barre
   d'espace produisent la même action que `J'ai compris — continuer`.
3. Si l'équation est la dernière étape, ces contrôles terminent proprement la
   sélection.
4. La barre d'espace ne commande pas la lecture pendant la saisie dans un
   réglage ou lorsqu'une boîte de dialogue est ouverte.

## Redimensionnement du lecteur de la version 0.15.18

1. En mode horizontal, agrandir la fenêtre augmente maintenant la hauteur de la
   zone de lecture jusqu'à `560px`.
2. Le mot courant, le contexte et les captures d'équations grandissent avec la
   hauteur disponible, entre `1×` et `1,6×`.
3. La taille choisie dans les réglages reste la taille de base du texte ; le
   facteur responsive s'ajoute uniquement lorsque la fenêtre est agrandie.
4. La taille extérieure de la fenêtre reste mémorisée entre deux utilisations.

## Équations aux frontières de la version 0.15.19

1. Une formule située exactement au début d'une sélection n'est plus perdue
   lorsque l'appariement de secours s'ancre sur son numéro placé à droite.
2. Les caractères mathématiques précédant ou suivant l'ancre sont réintégrés
   uniquement lorsqu'ils correspondent exactement, après normalisation, aux
   glyphes PDF adjacents.
3. Cette règle ne récupère pas une équation située avant un passage qui commence
   réellement par de la prose.
4. La sélection réelle de la page PDF 23 commence désormais sur `H ≡` et son
   premier segment RSVP est la capture détectée de l'équation `(2.48)`.

## Documentation de la version 0.15.20

1. Les listes de fonctionnalités des README anglais et français sont condensées
   autour des six capacités principales du projet.
2. Les informations détaillées d'installation, de fonctionnement et de
   compatibilité restent disponibles dans leurs sections dédiées.

## Feedback facultatif de la version 0.15.21

1. Le bouton **Signaler** ouvre un rapport prévisualisé avant toute action.
2. L'extrait sélectionné et l'image complète de la page disposent de cases de
   consentement séparées ; l'image est désactivée par défaut.
3. Sans relais configuré, aucune requête réseau n'est effectuée et le rapport
   peut seulement être copié localement.
4. Le dossier `feedback-relay` fournit un Worker facultatif qui crée une Issue
   et stocke l'éventuelle image dans un dépôt GitHub privé.
5. Le jeton GitHub reste dans un secret serveur et n'est jamais inclus dans
   l'extension.
6. `VITE_FEEDBACK_ENABLED=false` masque le bouton et n'initialise aucun de ses
   gestionnaires, sans supprimer le code.

## Signalement public de la version 0.15.22

1. Le mode par défaut ouvre une Issue publique préremplie sur le dépôt GitHub
   principal ; aucune publication n'est automatique.
2. L'utilisateur vérifie le rapport puis clique lui-même sur le bouton de
   publication de GitHub.
3. L'extrait est décoché par défaut et son caractère public est indiqué avant
   l'ouverture de GitHub.
4. L'image complète de la page n'est jamais incluse automatiquement dans une
   Issue publique.
5. `VITE_FEEDBACK_MODE=private` conserve le relais privé et
   `VITE_FEEDBACK_MODE=disabled` masque entièrement le bouton.
6. L'ancien réglage `VITE_FEEDBACK_ENABLED=false` reste accepté pour désactiver
   la fonctionnalité.

## Rythme adaptatif de la version 0.15.23

1. Les mots ordinaires de sept caractères ou moins conservent exactement la
   durée définie par les mots par minute.
2. Au-delà de sept caractères, la durée augmente progressivement avec la
   longueur du mot au lieu d'utiliser un seuil unique.
3. Les bonus de longueur, de ponctuation, de nombres et d'acronymes se
   cumulent, avec une durée maximale pour éviter les pauses excessives.
4. Les pauses des équations restent gérées séparément.
5. Les réglages proposent cinq profils persistants :
   `Désactivée`, `Légère`, `Normale`, `Forte` et `Extrême`.

## Contexte horizontal de la version 0.15.24

1. La case **Contexte sur une ligne** place les mots précédents à gauche et les
   mots suivants à droite du mot courant.
2. Le repère ORP du mot actif reste centré. Une largeur minimale est réservée
   dynamiquement à chaque côté selon la largeur de la fenêtre et le nombre de
   mots de contexte demandé.
3. Les mots très longs sont réduits uniquement si nécessaire pour préserver
   ces zones latérales. Les mots courts conservent leur taille normale.
4. Le mode reste désactivé par défaut, s'applique immédiatement et est conservé
   dans `chrome.storage.local`.
5. La carte des équations et son système de validation ne sont pas modifiés.

## Reprise et pauses structurelles de la version 0.15.25

1. Le bouton **↶** recommence la phrase courante. S'il est actionné au début
   de celle-ci, il revient au début de la phrase précédente.
2. La touche `Flèche haut` déclenche la même commande. La lecture reprend
   automatiquement depuis cette position si elle était déjà en cours.
3. En profil normal, une fin de phrase ajoute désormais `300 ms` et une fin de
   paragraphe `600 ms`, indépendamment du nombre de mots par minute.
4. Les profils léger, fort et extrême utilisent des pauses structurelles
   progressivement plus longues. Le profil désactivé conserve un rythme fixe.
5. Les paragraphes sont repérés depuis l'espacement des lignes et les fins de
   ligne de la couche PDF. Les retours à la ligne ordinaires ne sont pas
   confondus avec des changements de paragraphe.
6. Les limites de paragraphe servent aussi à la reprise par phrase lorsqu'un
   paragraphe ne se termine pas par un signe de ponctuation.
7. Les parenthèses ajoutent une pause structurelle à leur ouverture et à leur
   fermeture : `90 ms` en profil léger, `150 ms` en profil normal, `220 ms`
   en profil fort et `320 ms` en profil extrême. Une paire contenue dans le
   même élément cumule les deux pauses ; le profil désactivé n'en ajoute aucune.

## Mots longs et repère ORP des versions 0.15.26 et 0.15.27

1. Le bonus des mots longs est désormais un délai additif indépendant du nombre
   de mots par minute, comme les pauses de phrase et de paragraphe.
2. En profil fort, `straightforwardly` reste affiché environ `600 ms` à
   `300 mpm` et `500 ms` à `600 mpm`.
3. Le mot est construit autour de sa lettre ORP : cette lettre reste réellement
   sur l'axe central au lieu de centrer approximativement le mot entier.
4. Les repères corail de `2px` sont attachés directement à la lettre ORP. Leur
   distance au mot ne dépend donc plus de la hauteur de la zone de lecture.
5. En contexte horizontal, les groupes voisins sont positionnés à `12px` des
   limites visibles du mot plutôt que dans trois grandes colonnes.
6. La troncature conserve le texte le plus proche du mot courant : l'ellipse
   apparaît à gauche pour le contexte précédent et à droite pour le suivant.
7. Les mots longs continuent de réduire leur taille si la fenêtre devient
   étroite.

## Lecture audio synchronisée de la version 1.0.0

1. Le bouton **Lecture audio**, placé sous la barre de vitesse, reste désactivé
   par défaut. Le moteur hybride utilise `SpeechSynthesis` pour les voix
   naturelles en ligne d’Edge et `chrome.tts` pour les voix locales et le repli.
2. Les mots sont envoyés par segments continus afin d’éviter une voix hachée.
   L’affichage RSVP avance sur les événements `word` du moteur vocal.
3. La vitesse vocale est calculée depuis les MPM : `200 mpm` correspond à
   `rate = 1`, avec une plage limitée de `0.4` à `4`.
4. La langue française ou anglaise est détectée dans chaque segment. Les
   réglages regroupent les voix exposées par Edge en anglais, français et autres
   langues. **Microsoft Aria Online (Natural) - English (United States)** est
   affichée en premier et marquée comme recommandée lorsqu’elle est disponible.
5. Le choix **Automatique (locale)** n’utilise jamais une voix distante. Les
   voix en ligne sont marquées comme telles et ne sont utilisées qu’après une
   sélection explicite ; le segment prononcé peut alors être envoyé au service
   vocal Microsoft.
6. Pause, déplacement, reprise de phrase, changement de vitesse et changement
   de voix arrêtent le segment courant puis repartent du mot affiché.
7. Une équation n’est pas vocalisée. Son arrêt manuel ou automatique conserve
   le comportement déjà utilisé par la lecture visuelle.
8. Si une voix ne produit pas d’événements de mots, le minuteur RSVP sert de
   solution de repli. En cas d’erreur du moteur vocal, l’audio est désactivé et
   la lecture visuelle continue.
9. Les césures typographiques de fin de ligne sont reconstruites avant la
   tokenisation (`equa-` + `tions` devient `equations`). Le générateur audio
   applique la même réparation en dernier recours pour ne jamais prononcer les
   deux fragments séparément ; les composés usuels comme `well-known` gardent
   leur trait d’union et restent une seule unité vocale.

## Taille stable des mots de la version 1.1.0-beta.1

1. La taille du mot actif n'est plus recalculée à chaque changement de mot.
2. Une taille commune est calculée à partir du mot le plus contraignant du
   passage, de la largeur disponible et du réglage utilisateur.
3. Cette taille est la plus grande valeur commune permettant aux mots de tenir
   dans la fenêtre, avec un espace minimal conservé pour le contexte horizontal.
4. Le calcul est mis en cache et ne recommence qu'après une nouvelle sélection,
   un redimensionnement ou un changement de taille, de police ou de disposition.
5. Les équations conservent leur réglage de taille indépendant.

## Corrections importantes des versions 0.13.0 à 0.13.5

1. Un numéro de section comme `1.2.` n'est plus confondu avec le numéro
   d'équation `(1.2)`.
2. Une capture est maintenant associée à son numéro d'équation. L'image de
   `(1.3)` ne peut donc plus apparaître pendant la lecture de `(1.2)`.
3. La lecture attend que les captures nécessaires soient prêtes. L'équation ne
   doit plus être lue d'abord comme du texte puis remplacée par une image.
4. Le recadrage utilise la géométrie du texte PDF et la ligne de base de
   l'équation. Il exclut le titre et les paragraphes voisins.
5. Une expression mathématique en ligne sans numéro ne reçoit pas une capture
   appartenant à une autre équation.
6. Les chiffres et le caractère PDF représentant `□` restent dans le bloc
   mathématique au lieu de couper les équations `(1.2)` et `(1.3)`.
7. Un signe `=` isolé ne déclenche plus une fausse pause mathématique.
8. Le marqueur générique `f(x)` n'apparaît plus derrière la carte d'équation.
9. Les tokens compacts copiés par Edge, comme `∂2`, `t−` et `c2∇2`, restent
   dans une seule expression et leurs exposants sont restaurés dans KaTeX.
10. Les expressions non numérotées sont aussi retrouvées dans la couche texte
    du PDF. Les glyphes omis par Edge, comme le `□` du D'Alembertien, sont donc
    inclus dans une capture fidèle et serrée de la formule complète.
11. L'association d'une formule à sa capture tolère maintenant les glyphes
    mathématiques perdus par Edge, comme `ℏ`. Un second appariement par les mots
    de contexte encadrant la formule prend le relais si sa chaîne est inutilisable.
12. Chaque étape d'équation possède un identifiant stable. Les équations
    numérotées sont délimitées entre les paragraphes voisins puis regroupées
    spatialement, sans seuil fixe autour du numéro. Une formule non récupérée
    n'est plus remplacée silencieusement par une reconstruction potentiellement fausse.
13. Les puissances compactées par Edge, comme `m2c4`, restent dans l'équation
    numérotée complète. Une sous-formule présente plusieurs fois dans la page
    exige désormais un contexte non ambigu ; la première occurrence n'est plus
    choisie arbitrairement.

## Reprendre le développement

Dans un terminal ouvert dans ce dossier :

```powershell
npm install
npm run test
npm run build
```

Dans Edge, ouvrir `edge://extensions`, activer le mode développeur et charger le
dossier `dist` avec **Charger l'extension décompressée**. Activer également
**Autoriser l'accès aux URL de fichier** pour les PDF locaux.

Après chaque modification, exécuter `npm run build`, cliquer sur **Recharger**
dans Edge, puis fermer toute ancienne fenêtre RSVP Reader encore ouverte.

## Prochaine vérification utilisateur

Recharger la version 1.1.0-beta.1 et effectuer les vérifications suivantes :

- lire `straightforwardly` en profils normal puis fort ;
- comparer son affichage à `300` puis `600 mpm` ;
- vérifier que les deux repères restent proches de la lettre colorée ;
- tester ce positionnement avec et sans **Contexte sur une ligne** ;
- vérifier que les contextes voisins restent proches sans recouvrir le mot ;
- vérifier que le contexte précédent est affiché sous la forme `…texte`.
- basculer entre **Français** et **English** et vérifier le menu contextuel ;
- vérifier qu'un numéro comme `(1.2)` disparaît du texte et reste visible dans
  l'espace situé à droite de la capture d'équation.
- agrandir la fenêtre et vérifier que la carte d'équation reste centrée tandis
  que l'aperçu du passage utilise toute la hauteur inférieure disponible ;
- tester **Taille des images d’équation** à `60 %`, `100 %` et `180 %`, avec
  une expression courte puis une équation large.
- dans les réglages, choisir une voix anglaise locale puis une voix Microsoft
  en ligne si Edge en propose, en vérifiant particulièrement
  **Microsoft Aria Online (Natural) - English (United States)** ;
- activer le bouton **Lecture audio** sous la vitesse et vérifier à `200`, `300`
  puis `600 mpm` que le mot affiché correspond au mot prononcé ;
- pendant la lecture audio, tester Pause, `−5`, `+5`, la reprise de phrase et
  une équation en mode manuel.

## Phrase à donner à Codex sur un nouvel ordinateur

> Ouvre `PROJECT_HANDOFF.md` et le projet RSVP Reader Beta - Mathematical PDF.
> Reprends le développement à partir de la version 1.1.0-beta.1. Commence par vérifier l'état des
> fichiers et les tests, puis aide-moi à tester le comportement des équations
> dans mon PDF de cours.

Le PDF de cours ne doit pas être ajouté au dépôt GitHub : il reste un fichier de
test personnel en dehors du projet.
