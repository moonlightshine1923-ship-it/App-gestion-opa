import nodemailer from 'nodemailer';

// Configuration SMTP
const smtpConfig = {
  host: process.env.SMTP_HOST || 'smtp.opa.dz',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || 'notifications@opa.dz',
    pass: process.env.SMTP_PASS || 'SecretPasswordChangeMe',
  },
};

const defaultFrom = process.env.SMTP_FROM || '"Notifications OPA" <notifications@opa.dz>';
const notificationTarget = process.env.SMTP_ALERT_RECEIVER || 'abccd@opa.dz';

let transporter = null;
try {
  transporter = nodemailer.createTransport(smtpConfig);
} catch (err) {
  console.warn('transporter initialisation skipped:', err.message);
}

/**
 * Sends a notification email.
 * @param {string} subject - Subject of the email
 * @param {string} html - HTML content of the email
 * @param {string} text - Plain text fallback
 */
export async function sendNotificationEmail(subject, html, text) {
  try {
    // Fallback: Simulation si l'hôte SMTP ou le mot de passe est celui par défaut (non configuré)
    const isMockHost = !process.env.SMTP_HOST || process.env.SMTP_HOST === 'smtp.opa.dz' || smtpConfig.host === 'smtp.opa.dz';
    const isMockPass = !process.env.SMTP_PASS || smtpConfig.auth.pass === 'SecretPasswordChangeMe' || smtpConfig.auth.pass === '';
    
    if (isMockHost || isMockPass) {
      console.log('\n================================================================');
      console.log(`[ALERTE SECURITE EMAIL - SIMULATION (SMTP non configuré)]`);
      console.log(`Destinataire : ${notificationTarget}`);
      console.log(`Sujet        : ${subject}`);
      console.log('----------------------------------------------------------------');
      console.log(text);
      console.log('================================================================\n');
      return;
    }

    const mailOptions = {
      from: defaultFrom,
      to: notificationTarget,
      subject: `[OPA Alert] ${subject}`,
      text: text,
      html: html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL] Notification envoyée avec succès à ${notificationTarget} : ${info.messageId}`);
    return info;
  } catch (err) {
    console.error(`[EMAIL ERROR] Impossible d'envoyer la notification par email :`, err.message);
  }
}

/**
 * Helper to notify on Password Change.
 */
export async function notifyPasswordChanged({ userEmail, changedByEmail, ip, isResetByAdmin = false }) {
  const subject = `Changement de mot de passe - ${userEmail}`;
  const actionDesc = isResetByAdmin 
    ? `Le mot de passe de l'utilisateur <b>${userEmail}</b> a été réinitialisé par l'administrateur (<b>${changedByEmail}</b>).`
    : `L'utilisateur <b>${userEmail}</b> a changé son mot de passe lui-même.`;

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #0f172a;">
      <div style="border-bottom: 2px solid #2563eb; padding-bottom: 15px; margin-bottom: 20px;">
        <h2 style="color: #1e3a8a; margin: 0; font-size: 20px;">⚠️ Notification de sécurité - OPA</h2>
      </div>
      <p style="font-size: 15px; line-height: 1.6; color: #334155;">
        Bonjour,
      </p>
      <p style="font-size: 15px; line-height: 1.6; color: #334155;">
        Nous vous informons qu'une action de sécurité importante vient d'avoir lieu sur la plateforme OPA.
      </p>
      <div style="background-color: #f1f5f9; border-left: 4px solid #2563eb; padding: 15px; border-radius: 4px; margin: 20px 0;">
        <p style="margin: 0; font-size: 14.5px; line-height: 1.6; color: #1e293b;">
          ${actionDesc}
        </p>
      </div>
      <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 14px;">
        <tr>
          <td style="padding: 8px 0; color: #64748b; width: 140px;"><b>Compte ciblé :</b></td>
          <td style="padding: 8px 0; color: #0f172a;">${userEmail}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b;"><b>Date / Heure :</b></td>
          <td style="padding: 8px 0; color: #0f172a;">${new Date().toLocaleString('fr-FR')}</td>
        </tr>
      </table>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 25px 0;" />
      <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
        Ceci est un message automatique de sécurité généré par l'application OPA.
      </p>
    </div>
  `;

  const text = `Notification de sécurité OPA :\n\nCompte ciblé : ${userEmail}\nAction : ${isResetByAdmin ? 'Réinitialisation de mot de passe par l\'admin (' + changedByEmail + ')' : 'Changement de mot de passe par l\'utilisateur lui-même'}\nDate : ${new Date().toLocaleString('fr-FR')}`;

  return sendNotificationEmail(subject, html, text);
}

/**
 * Helper to notify on User Creation.
 */
export async function notifyUserCreated({ createdUserEmail, createdUserRole, createdByEmail, ip }) {
  const subject = `Création d'un nouveau compte - ${createdUserEmail}`;
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #0f172a;">
      <div style="border-bottom: 2px solid #10b981; padding-bottom: 15px; margin-bottom: 20px;">
        <h2 style="color: #065f46; margin: 0; font-size: 20px;">👤 Nouveau compte utilisateur créé - OPA</h2>
      </div>
      <p style="font-size: 15px; line-height: 1.6; color: #334155;">
        Bonjour,
      </p>
      <p style="font-size: 15px; line-height: 1.6; color: #334155;">
        Un nouveau compte d'accès vient d'être créé sur la plateforme OPA par l'administrateur <b>${createdByEmail}</b>.
      </p>
      <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px; background-color: #f8fafc; border-radius: 8px; padding: 15px; display: block;">
        <tr style="display: block; margin-bottom: 10px;">
          <td style="color: #64748b; width: 140px; display: inline-block;"><b>Nouvel utilisateur :</b></td>
          <td style="color: #0f172a; font-weight: bold; display: inline-block;">${createdUserEmail}</td>
        </tr>
        <tr style="display: block; margin-bottom: 10px;">
          <td style="color: #64748b; width: 140px; display: inline-block;"><b>Rôle assigné :</b></td>
          <td style="color: #0f172a; display: inline-block;"><span style="background-color: #d1fae5; color: #065f46; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: bold;">${createdUserRole}</span></td>
        </tr>
        <tr style="display: block; margin-bottom: 10px;">
          <td style="color: #64748b; width: 140px; display: inline-block;"><b>Créé par :</b></td>
          <td style="color: #0f172a; display: inline-block;">${createdByEmail}</td>
        </tr>
        <tr style="display: block;">
          <td style="color: #64748b; width: 140px; display: inline-block;"><b>Date :</b></td>
          <td style="color: #0f172a; display: inline-block;">${new Date().toLocaleString('fr-FR')}</td>
        </tr>
      </table>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 25px 0;" />
      <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
        Ceci est un message automatique généré par l'application OPA.
      </p>
    </div>
  `;

  const text = `Nouveau compte créé sur OPA :\n\nNouvel utilisateur : ${createdUserEmail}\nRôle : ${createdUserRole}\nCréé par  : ${ip || 'Inconnue'}\nDate : ${new Date().toLocaleString('fr-FR')}`;

  return sendNotificationEmail(subject, html, text);
}

/**
 * Helper to notify on Successful Login.
 */
export async function notifyUserLogin({ userEmail, userRole, ip }) {
  const subject = `Nouvelle connexion utilisateur - ${userEmail}`;
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #0f172a;">
      <div style="border-bottom: 2px solid #3b82f6; padding-bottom: 15px; margin-bottom: 20px;">
        <h2 style="color: #1e3a8a; margin: 0; font-size: 20px;">🔑 Nouvelle connexion détectée - OPA</h2>
      </div>
      <p style="font-size: 15px; line-height: 1.6; color: #334155;">
        Bonjour,
      </p>
      <p style="font-size: 15px; line-height: 1.6; color: #334155;">
        Une nouvelle connexion vient d'être enregistrée pour l'utilisateur <b>${userEmail}</b>.
      </p>
      <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px; background-color: #f8fafc; border-radius: 8px; padding: 15px; display: block;">
        <tr style="display: block; margin-bottom: 10px;">
          <td style="color: #64748b; width: 140px; display: inline-block;"><b>Utilisateur :</b></td>
          <td style="color: #0f172a; font-weight: bold; display: inline-block;">${userEmail}</td>
        </tr>
        <tr style="display: block; margin-bottom: 10px;">
          <td style="color: #64748b; width: 140px; display: inline-block;"><b>Rôle :</b></td>
          <td style="color: #0f172a; display: inline-block;"><span style="background-color: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: bold;">${userRole}</span></td>
        </tr>
        <tr style="display: block;">
          <td style="color: #64748b; width: 140px; display: inline-block;"><b>Date :</b></td>
          <td style="color: #0f172a; display: inline-block;">${new Date().toLocaleString('fr-FR')}</td>
        </tr>
      </table>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 25px 0;" />
      <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
        Ceci est un message automatique de sécurité généré par l'application OPA.
      </p>
    </div>
  `;

  const text = `Nouvelle connexion OPA :\n\nUtilisateur : ${userEmail}\nRôle  : ${ip || 'Inconnue'}\nDate : ${new Date().toLocaleString('fr-FR')}`;

  return sendNotificationEmail(subject, html, text);
}
