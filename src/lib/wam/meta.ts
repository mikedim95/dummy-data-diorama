export const meta = (title: string, description: string) => ({
  meta: [
    { title: `${title} · WAM Operator` },
    { name: "description", content: description },
    { property: "og:title", content: `${title} · WAM Operator` },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ],
});
