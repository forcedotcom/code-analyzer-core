%dw 2.0
output application/java
---
{
  headers: {
    To: "customer@example.com",
    Subject: "Property Update",
    "In-Reply-To": $(validatedMessageId),
    References: $(validatedMessageId),
    From: "noreply@dreamhouse.com"
  },
  body: payload.message
}
