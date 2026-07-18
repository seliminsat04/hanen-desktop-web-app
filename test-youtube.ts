// YouTube testing
import dotenv from "dotenv";
dotenv.config();

async function run() {
  const youtubeKey = process.env.YOUTUBE_API_KEY;
  if (!youtubeKey) {
    console.error("No YOUTUBE_API_KEY found.");
    return;
  }
  
  const query = "comment prendre tension artérielle";
  console.log(`Searching YouTube for: ${query}`);
  
  try {
    const ytResponse = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=${encodeURIComponent(query)}&type=video&key=${youtubeKey}`);
    console.log("Status:", ytResponse.status);
    if (!ytResponse.ok) {
       console.error("Error from API:", await ytResponse.text());
       return;
    }
    const ytData = await ytResponse.json();
    if (ytData.items && ytData.items.length > 0) {
      console.log("Found Video:");
      console.log("Title:", ytData.items[0].snippet.title);
      console.log("Video URL: https://www.youtube.com/watch?v=" + ytData.items[0].id.videoId);
      console.log("Thumbnail:", ytData.items[0].snippet.thumbnails?.high?.url);
    } else {
      console.log("No videos found.");
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
