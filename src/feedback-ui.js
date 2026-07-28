import { FEEDBACK_CONFIG } from './feedback-config.js';
import {
  buildFeedbackReport,
  feedbackEndpoint,
  formatFeedbackReport,
  publicFeedbackIssueUrl,
  publicIssueEndpoint,
  submitFeedbackReport
} from './feedback-report.js';

const $ = selector => document.querySelector(selector);

function openExternalPage(url) {
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.click();
}

export function initializeFeedback({
  config = FEEDBACK_CONFIG,
  getContext,
  onOpen = () => {}
}) {
  const button = $('#feedbackButton');
  const dialog = $('#feedbackDialog');
  const mode = config.mode || (config.enabled === false ? 'disabled' : 'public');
  if (mode === 'disabled' || config.enabled === false) {
    button?.classList.add('hidden');
    return { enabled: false, mode: 'disabled' };
  }

  button.classList.remove('hidden');
  const publicMode = mode === 'public';
  const form = $('#feedbackForm');
  const intro = $('#feedbackIntro');
  const description = $('#feedbackDescription');
  const includeExcerpt = $('#feedbackIncludeExcerpt');
  const includeExcerptText = $('#feedbackIncludeExcerptText');
  const includePage = $('#feedbackIncludePage');
  const includePageLabel = $('#feedbackIncludePageLabel');
  const preview = $('#feedbackPreview');
  const pagePreview = $('#feedbackPagePreview');
  const status = $('#feedbackStatus');
  const send = $('#feedbackSend');
  let endpoint = null;
  let endpointError = null;

  try {
    endpoint = publicMode
      ? publicIssueEndpoint(config.publicIssueUrl)
      : feedbackEndpoint(config.endpoint);
  } catch (error) {
    endpointError = error;
  }

  intro.textContent = publicMode
    ? 'Le rapport ouvrira une Issue GitHub publique préremplie. Vérifiez-la avant de la publier.'
    : 'Vérifiez les informations ci-dessous. L’extrait et l’image ne sont inclus qu’avec votre accord.';
  includeExcerptText.textContent = publicMode
    ? 'Inclure l’extrait sélectionné dans l’Issue publique'
    : 'Inclure l’extrait sélectionné';
  includePageLabel.classList.toggle('hidden', publicMode);

  function setStatus(message, kind = '') {
    status.textContent = message;
    status.dataset.kind = kind;
  }

  function reportInput() {
    const context = getContext();
    return {
      ...context,
      category: $('#feedbackCategory').value,
      description: description.value,
      includeExcerpt: includeExcerpt.checked && !includeExcerpt.disabled,
      includePageImage: !publicMode && includePage.checked && !includePage.disabled
    };
  }

  function currentReport() {
    return buildFeedbackReport(reportInput(), config);
  }

  function readyStatus() {
    if (endpointError) return [endpointError.message, 'error'];
    if (publicMode) {
      return includeExcerpt.checked
        ? ['Attention : l’extrait sélectionné sera visible publiquement sur GitHub.', 'warning']
        : ['Seuls la description et les diagnostics affichés seront préremplis publiquement.', 'warning'];
    }
    return endpoint
      ? ['Le rapport privé sera envoyé uniquement après votre validation.', '']
      : ['Envoi privé non configuré : vous pouvez copier le rapport.', ''];
  }

  function refreshPreview() {
    const context = getContext();
    includeExcerpt.disabled = !context.selectionText;
    includePage.disabled = publicMode || !context.pageCapture;
    if (includeExcerpt.disabled) includeExcerpt.checked = false;
    if (includePage.disabled) includePage.checked = false;
    pagePreview.classList.toggle('hidden', !includePage.checked || !context.pageCapture);
    if (includePage.checked && context.pageCapture) pagePreview.src = context.pageCapture;

    if (!description.value.trim()) {
      preview.textContent = 'Décrivez le problème pour afficher le rapport.';
      const [message, kind] = readyStatus();
      setStatus(message, kind);
      return;
    }
    try {
      preview.textContent = formatFeedbackReport(currentReport());
      const [message, kind] = readyStatus();
      setStatus(message, kind);
    } catch (error) {
      preview.textContent = error.message;
      setStatus(error.message, 'error');
    }
  }

  button.addEventListener('click', () => {
    onOpen();
    form.reset();
    includeExcerpt.checked = !publicMode;
    includePage.checked = false;
    send.disabled = !endpoint;
    send.textContent = publicMode
      ? 'Ouvrir l’Issue publique'
      : (endpoint ? 'Envoyer en privé' : 'Envoi privé à configurer');
    refreshPreview();
    dialog.showModal();
    description.focus();
  });

  form.addEventListener('input', refreshPreview);
  $('#feedbackCancel').addEventListener('click', () => dialog.close());
  $('#feedbackCopy').addEventListener('click', async () => {
    try {
      const report = currentReport();
      await navigator.clipboard.writeText(formatFeedbackReport(report));
      setStatus(report.pageImage
        ? 'Texte copié. L’image de la page reste séparée du presse-papiers.'
        : 'Rapport copié dans le presse-papiers.', 'success');
    } catch (error) {
      setStatus(error.message, 'error');
    }
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!endpoint) return;
    send.disabled = true;
    try {
      const report = currentReport();
      if (publicMode) {
        openExternalPage(publicFeedbackIssueUrl(report, endpoint));
        send.disabled = false;
        send.textContent = 'Ouvrir à nouveau';
        setStatus(
          'Issue préremplie ouverte. Vérifiez son contenu sur GitHub, puis publiez-la manuellement.',
          'success'
        );
        return;
      }

      send.textContent = 'Envoi…';
      setStatus('Envoi du rapport privé…');
      const result = await submitFeedbackReport(report, endpoint);
      send.textContent = 'Envoyé';
      setStatus(
        result.reportId
          ? `Rapport envoyé. Référence : ${result.reportId}`
          : 'Rapport envoyé en privé.',
        'success'
      );
    } catch (error) {
      send.disabled = false;
      send.textContent = publicMode ? 'Réessayer d’ouvrir' : 'Réessayer';
      setStatus(error.message, 'error');
    }
  });

  return {
    enabled: true,
    mode,
    endpointConfigured: !!endpoint
  };
}
