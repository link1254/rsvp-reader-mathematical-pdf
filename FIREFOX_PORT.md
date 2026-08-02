# RSVP Reader Beta - portage Firefox

Cette branche locale developpe le portage Firefox sans modifier les branches Chromium.

## Construction

```powershell
npm run build:firefox
```

La commande produit `dist-firefox`. Elle ne supprime et ne remplace pas `dist`, qui reste le build Chromium.

## Installation temporaire

1. Ouvrir `about:debugging#/runtime/this-firefox` dans Firefox.
2. Choisir `Charger un module complementaire temporaire`.
3. Selectionner `dist-firefox/manifest.json`.
4. Selectionner du texte dans un PDF, puis utiliser le menu contextuel RSVP Reader Beta.

## Premiere portee fonctionnelle

- fenetre de lecture horizontale et reutilisation de la fenetre existante ;
- menu contextuel sur une selection ;
- extraction PDF, detection mathematique locale et images haute resolution ;
- reglages, themes, apercu du passage et lecture RSVP ;
- synthese vocale via les voix Web Speech exposees par Firefox ;
- barre laterale Firefox comme solution de repli.

Pour un PDF local `file://`, Firefox interdit la lecture automatique du fichier. Le lecteur demande donc de confirmer le PDF avec le selecteur de fichier. Les octets restent uniquement en memoire et sont reutilises pour les selections suivantes tant que la fenetre du lecteur reste ouverte.

La voix Microsoft Aria Online fournie par Edge n'est pas exposee par Firefox. Le portage utilise donc les voix disponibles dans Firefox et dans le systeme d'exploitation.

## Differences techniques

- Chromium : `background.service_worker` et `side_panel` ;
- Firefox : `background.scripts` et `sidebar_action` ;
- le manifeste Firefox retire les permissions Chromium `sidePanel` et `tts` ;
- la version Firefox possede un identifiant Gecko et declare ne collecter aucune donnee.
