# Détection fiable des mathématiques dans les PDF

Implémentation complète du flux RSVP livrée dans la version **0.15.19**.

## Conclusion

Un PDF ne contient pas nécessairement la notion d'« équation ». Il décrit avant
tout une page avec des opérations de dessin : glyphes, images et tracés
vectoriels. Une formule peut donc être :

- un élément sémantique `Formula` avec MathML ou texte alternatif ;
- une suite de glyphes positionnés séparément ;
- un dessin vectoriel ;
- une image dans la page ;
- un mélange de ces représentations.

Le texte copié par Edge n'est pas une source de vérité. Il perd des glyphes,
modifie leur ordre et supprime la structure bidimensionnelle des fractions,
racines, matrices, indices et exposants.

Le lecteur ne doit plus essayer de reconstruire ou de reconnaître les équations
à partir de `selectionText`.

## Résultat de l'audit du PDF de référence

Pour la page 9 de `NewQFTLectureNotes_08_2024.pdf` :

- `PDFPageProxy.getStructTree()` renvoie `null` ;
- `getTextContent({ includeMarkedContent: true })` ne renvoie aucun contenu
  marqué ;
- les styles de polices exposés par PDF.js sont génériques (`sans-serif` ou
  `monospace`) et ne permettent pas d'identifier les mathématiques ;
- les équations sont uniquement récupérables comme glyphes et opérations
  graphiques positionnés sur la page.

Il n'existe donc aucune balise exploitable dans ce document pour annoncer une
équation.

## Architecture retenue

### 1. Analyser la page, pas la chaîne copiée

PDF.js ouvre le fichier source et produit pour la page :

- son arbre de structure éventuel ;
- les boîtes des éléments de texte ;
- un rendu bitmap de la page ;
- les dimensions et transformations entre espace PDF et pixels.

La sélection Edge sert seulement à retrouver la page et l'intervalle de lecture.
Elle ne sert plus à définir les limites d'une formule.

Depuis la version `0.15.2`, toutes les pages candidates sont comparées à partir
des groupes de mots présents dans l'ensemble du passage. Une page n'est retenue
que si sa couverture du contenu intérieur est suffisante et clairement
supérieure aux autres candidats. Une ressemblance limitée aux premiers et
derniers mots est refusée.

Depuis la version `0.15.14`, un alignement ordonné de l'ensemble des mots prend
le relais lorsque le lecteur PDF omet ou réordonne des glyphes mathématiques
dans le texte copié. Une ancre de prose localise le début, puis l'alignement
tolère les différences dans les formules et retrouve la fin réelle du passage.
Ce secours exige une couverture élevée et reste comparé à toutes les pages pour
éviter de choisir un passage similaire dans un autre chapitre.

Depuis la version `0.15.16`, un troisième niveau traite les lecteurs PDF qui
suppriment les espaces entre les mots. Les caractères alphanumériques sont
normalisés, une longue ancre exacte localise la zone, puis un alignement global
tolère les différences dans les formules. Cette méthode n'est acceptée qu'avec
une couverture élevée et un candidat non ambigu parmi toutes les pages.

### 2. Utiliser deux détecteurs ordonnés

#### Détecteur sémantique

Quand l'arbre de structure existe, les éléments `Formula`, MathML, `Alt` et
`ActualText` donnent les régions mathématiques avec une confiance maximale.

#### Détecteur visuel

Quand le PDF n'est pas balisé, la page rendue est passée dans un modèle local de
détection de formules. Le modèle renvoie des boîtes pour les formules affichées
et les formules en ligne, indépendamment de leur encodage comme texte, vecteurs
ou images.

Le détecteur embarqué est **Pix2Text MFD 1.5**, exécuté localement avec
`onnxruntime-web`. Le modèle ONNX et son runtime WebAssembly sont fournis dans
`public/models`; aucun PDF n'est envoyé à un service externe.

La version `0.15.3` utilise un double seuil. Une boîte de confiance `>= 0.8`
est acceptée directement. Une boîte entre `0.4` et `0.8` doit être confirmée
par la couche PDF : glyphe mathématique explicite, fragment compact dans une
police non dominante, ou géométrie d'indice/exposant. Les boîtes faibles qui
englobent plusieurs détections plus précises sont éliminées.

Les numéros `(1.2)`, les symboles extraits et la géométrie de PDF.js peuvent
confirmer ou ajuster une boîte détectée. Ils ne doivent jamais constituer le
détecteur principal.

### 3. Créer des identifiants géométriques

Chaque région mathématique est représentée par :

```js
{
  pageNumber,
  bbox: { x, y, width, height },
  kind: 'inline' | 'display',
  source: 'structure' | 'vision',
  confidence,
  label: null | '(1.5)',
  fingerprint
}
```

L'identité d'une équation dépend de la page et de sa boîte, jamais de son texte
ou de son numéro seul.

### 4. Construire le flux RSVP depuis la mise en page

Les boîtes de texte PDF et les régions mathématiques sont ordonnées
géométriquement. Tous les glyphes qui intersectent une même région mathématique
sont remplacés par une unique étape `equation`.

L'étape affiche une capture directe de la région dans le rendu PDF. Elle
n'affiche jamais une formule reconstruite depuis les caractères extraits.

Depuis la version `0.15.0`, cette règle est appliquée à toutes les régions
mathématiques de la sélection, et non plus seulement aux expressions que le
texte copié semblait mathématique. L'association est faite caractère par
caractère dans les coordonnées de PDF.js. Un fragment PDF mixte comme
`formule. Thus` peut donc être séparé proprement en une capture et en texte.
Depuis la version `0.15.1`, l'intersection verticale est confirmée par la ligne
de base PDF. Cette règle conserve les indices et exposants décalés tout en
empêchant une boîte de formule d'absorber des caractères de la ligne voisine.

Les caractères d'une région détectée sont supprimés du flux textuel. Une
notation résiduelle reconnue par le moteur textuel est masquée et signalée comme
non résolue ; elle n'est jamais affichée sous une transcription potentiellement
fausse.

### 5. Refuser les associations ambiguës

Une région est affichée automatiquement seulement si :

- elle vient d'un élément sémantique `Formula` ; ou
- le détecteur visuel dépasse le seuil de confiance retenu et son association à
  l'intervalle sélectionné est unique.

Sinon, l'interface indique « formule non identifiée » et propose la sélection
manuelle. Montrer aucune formule est préférable à montrer une formule fausse.

## Validation effectuée

- Le modèle ONNX est chargé avec succès en Node.js et dans Microsoft Edge.
- L'inférence WebAssembly fonctionne hors ligne sur CPU.
- Les pages 9, 10 et 11 du PDF de référence ont été rendues puis analysées.
- Les équations affichées `(1.1)` à `(1.17)`, les racines et les fractions sont
  couvertes par les boîtes détectées lors de l'inspection visuelle.
- Le seuil automatique est fixé à `0.8`. Il élimine les faux positifs observés
  dans le texte italique de la page 9.
- Sur la page 9 rendue en `1190 × 1684`, l'entrée du modèle vaut
  `1 × 3 × 1088 × 768`; l'inférence CPU mesurée prend environ 4 à 5 secondes.
- Une association absente ou ambiguë est refusée et laisse la capture manuelle
  disponible.
- La page PDF 66, correspondant à la page imprimée 65, contient 29 régions
  mathématiques au seuil retenu. Après segmentation, aucun symbole grec,
  intégral, racine, opérateur ou signe égal ne reste dans le texte RSVP.
- La formule en ligne `F₁(q)q̇ = dI(q)/dt with I(q)=∫F₁(q)` produit exactement
  trois étapes : capture, mot `with`, capture.
- Ce cas a été validé de bout en bout dans Microsoft Edge avec le vrai PDF :
  page 66 retrouvée, deux images générées et zéro notation non résolue.
- La page PDF 79 a également été validée de bout en bout dans Edge : 24
  captures générées, zéro notation non résolue, zéro symbole mathématique dans
  le texte et aucun mot ordinaire perdu. Les renvois `eqs (4.99)` et
  `eq. (4.95)` restent du texte.
- Le rendu complet de la page est réutilisé par l'éditeur de capture manuelle ;
  ce parcours et le bouton final **Terminer** ont été testés dans Edge.
- Le début de la section `4.2.2` sur la page PDF 73 a été validé dans Edge avec
  8 captures et aucun blocage.
- Un extrait dégradé de la page PDF 120 a été localisé sur cette page, et non
  sur la première correspondance partielle : 16 captures ont été produites.
- Deux sélections consécutives et deux sélections lancées rapidement ont été
  validées. Les analyses remplacées sont annulées, les inférences sont
  sérialisées et leurs ressources sont libérées.
- Sur la page PDF 18, les quatre petites notations en ligne `q_a`, `p_a`,
  `q̂_a` et `p̂_a`, dont les confiances Edge vont de `0.458` à `0.672`, sont
  toutes confirmées et affichées comme quatre captures.
- Sur la page PDF 9, la boîte faible couvrant le texte italique « a field » est
  rejetée. Le passage de contrôle contient zéro notation.

Cette validation porte sur le PDF de référence. Un corpus plus large reste
nécessaire pour mesurer formellement précision et rappel sur tous les types de
PDF (LaTeX, Word, PDF balisé et page scannée).

## Sources techniques

- PDF.js, `PDFPageProxy`: https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFPageProxy.html
- PDF Association, élément `Formula`: https://taggedpdfschool.pdfa.org/tags/Formula
- PDF Association, *Best Practice Guide: Math in PDF*:
  https://pdfa.org/download-area/publications/BPG-Math-in-PDF.pdf
- ScanSSD, détection visuelle de formules:
  https://arxiv.org/abs/2003.08005
- MathSeer, extraction combinant boîtes PDF et détection visuelle:
  https://www.cs.rit.edu/~rlaz/files/ICDAR2021_MathSeer_Pipeline.pdf
- Pix2Text MFD ONNX:
  https://huggingface.co/breezedeus/pix2text-mfd-1.5
