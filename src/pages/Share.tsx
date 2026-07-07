import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ShareContent from "@/components/ShareContent";

const Share = () => (
  <div className="min-h-screen flex flex-col bg-background">
    <Header />
    <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
      <ShareContent />
    </main>
    <Footer />
  </div>
);

export default Share;
