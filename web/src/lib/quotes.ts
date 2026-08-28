// 内置英文励志语录（Mock 数据，随机展示）
export interface Quote {
  text: string;
  author: string;
}

export const QUOTES: Quote[] = [
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { text: "Done is better than perfect.", author: "Sheryl Sandberg" },
  { text: "Focus is about saying no.", author: "Steve Jobs" },
  { text: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci" },
  { text: "Well done is better than well said.", author: "Benjamin Franklin" },
  { text: "Action is the foundational key to all success.", author: "Pablo Picasso" },
  { text: "The best way out is always through.", author: "Robert Frost" },
  { text: "What you do every day matters more than what you do once in a while.", author: "Gretchen Rubin" },
  { text: "Small deeds done are better than great deeds planned.", author: "Peter Marshall" },
  { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
  { text: "Discipline is choosing between what you want now and what you want most.", author: "Abraham Lincoln" },
  { text: "Amateurs sit and wait for inspiration; the rest of us just get up and go to work.", author: "Stephen King" },
  { text: "The way to get started is to quit talking and begin doing.", author: "Walt Disney" },
  { text: "Energy and persistence conquer all things.", author: "Benjamin Franklin" },
  { text: "Either you run the day, or the day runs you.", author: "Jim Rohn" },
  { text: "Concentrate all your thoughts upon the work in hand.", author: "Alexander Graham Bell" },
  { text: "Nothing will work unless you do.", author: "Maya Angelou" },
  { text: "Do the hard jobs first. The easy jobs will take care of themselves.", author: "Dale Carnegie" },
  { text: "Perfection is not attainable, but if we chase perfection we can catch excellence.", author: "Vince Lombardi" },
  { text: "Start where you are. Use what you have. Do what you can.", author: "Arthur Ashe" },
  { text: "Quality is not an act, it is a habit.", author: "Aristotle" },
  { text: "The future depends on what you do today.", author: "Mahatma Gandhi" },
  { text: "Lost time is never found again.", author: "Benjamin Franklin" },
  { text: "Make each day your masterpiece.", author: "John Wooden" },
  { text: "Motivation gets you going, but discipline keeps you growing.", author: "John C. Maxwell" },
  { text: "Great things are done by a series of small things brought together.", author: "Vincent van Gogh" },
  { text: "Do not wait to strike till the iron is hot, but make it hot by striking.", author: "William Butler Yeats" },
  { text: "Whenever you are asked if you can do a job, tell 'em, 'Certainly I can!' Then get busy and find out how to do it.", author: "Theodore Roosevelt" },
  { text: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier" },
];

/** 随机取一条语录（可排除当前索引，避免刷新后重复） */
export function randomQuote(excludeIndex = -1): { quote: Quote; index: number } {
  let index = Math.floor(Math.random() * QUOTES.length);
  if (QUOTES.length > 1 && index === excludeIndex) {
    index = (index + 1) % QUOTES.length;
  }
  return { quote: QUOTES[index], index };
}
