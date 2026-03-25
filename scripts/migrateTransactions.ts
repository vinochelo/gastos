import { db } from "@/lib/firebase";
import { collection, getDocs, updateDoc, doc, query, where } from "firebase/firestore";

async function migrate() {
  console.log("Starting migration...");
  const transactionsRef = collection(db, "transactions");
  const snapshot = await getDocs(transactionsRef);
  
  let count = 0;
  for (const document of snapshot.docs) {
    const data = document.data();
    if (!data.createdAt) {
      await updateDoc(doc(db, "transactions", document.id), {
        createdAt: data.timestamp || new Date()
      });
      count++;
    }
  }
  console.log(`Updated ${count} transactions.`);
}

migrate();
