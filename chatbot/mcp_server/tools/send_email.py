import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from ..config import GMAIL_APP_PASSWORD

GMAIL_SENDER = "syncscholar079@gmail.com"

def send_email(data):

    to = data["to"]
    subject = data["subject"]
    body = data["body"]

    print("[MCP] send_email ->", to)

    msg = MIMEMultipart()
    msg["From"] = GMAIL_SENDER
    msg["To"] = to
    msg["Subject"] = subject
    import markdown
    html_body = markdown.markdown(body, extensions=['extra', 'nl2br'])
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
            smtp.login(GMAIL_SENDER, GMAIL_APP_PASSWORD)
            smtp.sendmail(GMAIL_SENDER, to, msg.as_string())
        return {"result": "Email sent via Gmail"}
    except smtplib.SMTPAuthenticationError:
        return {"result": "Gmail error: Authentication failed. Check your App Password."}
    except smtplib.SMTPException as e:
        return {"result": f"Gmail error: {str(e)}"}
