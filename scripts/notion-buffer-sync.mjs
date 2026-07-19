console.log("Test script");
console.log("DB:", process.env.NOTION_DATABASE_ID || "MISSING");
console.log("Token:", !!process.env.NOTION_TOKEN);
console.log("Buffer Key:", !!process.env.BUFFER_API_KEY);
