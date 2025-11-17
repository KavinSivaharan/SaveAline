import { ScraperForm } from "@/components/ScraperForm";
import { ScrapeHistory } from "@/components/ScrapeHistory";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Index = () => {
  return (
    <div className="min-h-screen relative overflow-hidden bg-background">
      {/* Dark gradient mesh background */}
      <div className="fixed inset-0 -z-10" style={{ background: 'var(--gradient-mesh)' }} />
      <div className="fixed inset-0 -z-10 bg-background" />
      
      <div className="container py-20 px-4 md:px-6 max-w-4xl">
        <div className="mb-16 text-center space-y-4">
          <h1 className="text-6xl md:text-7xl font-medium tracking-tight text-foreground" style={{ textShadow: 'var(--shadow-glow)' }}>
            Aline Assessment
          </h1>
          <p className="text-xl text-muted-foreground max-w-xl mx-auto font-light">
            Import technical knowledge from any website
          </p>
        </div>
        
        <Tabs defaultValue="scraper" className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-8">
            <TabsTrigger value="scraper">New Scrape</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
          <TabsContent value="scraper">
            <ScraperForm />
          </TabsContent>
          <TabsContent value="history">
            <ScrapeHistory />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
