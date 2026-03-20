%dw 2.0
output application/java
---
{
  headers: {
    To: $(payload.recipientEmail),
    Subject: $(payload.subject),
    From: $(payload.fromAddress)
  },
  body: payload.message
}
