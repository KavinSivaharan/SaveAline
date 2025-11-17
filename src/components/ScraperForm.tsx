import { useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { FirecrawlService } from '@/lib/firecrawl-service';
import { Loader2, ExternalLink, Sparkles, CheckCircle2 } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import ReactMarkdown from 'react-markdown';
import { supabase } from '@/integrations/supabase/client';

interface ScrapedItem {
  title: string;
  content: string;
  content_type: string;
  source_url: string;
}

interface ScrapeResult {
  site: string;
  items: ScrapedItem[];
}

interface CrawlStatusData {
  status: string;
  completed: number;
  total: number;
  data: Array<{
    markdown?: string;
    metadata?: {
      title?: string;
      description?: string;
      url?: string;
      ogTitle?: string;
    };
  }>;
}

export const ScraperForm = () => {
  const { toast } = useToast();
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ScrapeResult | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url) {
      toast({
        title: "URL Required",
        description: "Please enter a website URL to scrape",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setResult(null);
    setProgress({ current: 0, total: 0 });

    try {
      console.log('Starting scrape for:', url);
      
      toast({
        title: "Scraping started",
        description: "Discovering and scraping pages...",
      });

      // Call scrape function with progress callback
      const scrapeResult = await FirecrawlService.crawlWebsite(url, (current, total) => {
        setProgress({ current, total });
      });

      if (!scrapeResult.success || !scrapeResult.data) {
        throw new Error(scrapeResult.error || 'Failed to scrape website');
      }

      const scrapeData = scrapeResult.data;
      const items: ScrapedItem[] = scrapeData.items || [];

      if (items.length === 0) {
        toast({
          title: "No Content Found",
          description: "No content could be extracted from the website",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      setResult({
        site: url,
        items
      });
      
      toast({
        title: "Success!",
        description: `Successfully scraped ${items.length} items`,
      });
    } catch (error) {
      console.error('Scraping error:', error);
      toast({
        title: "Scraping Failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyJSON = () => {
    if (!result) return;
    navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    toast({
      title: "Copied!",
      description: "JSON output copied to clipboard",
    });
  };

  const handleDownloadJSON = () => {
    if (!result) return;
    const dataStr = JSON.stringify(result, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `scrape-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({
      title: "Downloaded!",
      description: "JSON file downloaded successfully",
    });
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <Card className="border-border shadow-glass backdrop-blur-xl relative overflow-hidden" style={{ background: 'var(--gradient-card)', boxShadow: 'var(--shadow-glass)' }}>
        {/* Shine effect overlay */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'var(--gradient-shine)' }} />
        
        <CardContent className="pt-10 pb-10 px-8 relative">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-4">
              <Input
                type="url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                disabled={isLoading}
                className="h-16 text-lg px-6 bg-background/80 border-border/80 rounded-xl backdrop-blur-sm focus-visible:ring-1 focus-visible:ring-foreground/20 transition-all"
              />
              <Button 
                type="submit" 
                disabled={isLoading || !url.trim()}
                className="w-full h-16 text-lg font-semibold rounded-xl bg-foreground text-background hover:bg-foreground/90 transition-all relative overflow-hidden group"
                size="lg"
              >
                <span className="relative z-10">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Import Knowledge'
                  )}
                </span>
                {/* Button shine effect */}
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              </Button>
            </div>
            
            {isLoading && (
              <div className="space-y-3 pt-2">
                <Progress 
                  value={progress.total > 0 ? (progress.current / progress.total) * 100 : 0} 
                  className="h-1.5"
                />
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>
                    {progress.total > 0 
                      ? `Scraped ${progress.current}/${progress.total} pages`
                      : 'Discovering pages...'}
                  </span>
                </div>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {result && (
        <div className="mt-10 space-y-5 animate-fade-in">
          <div className="p-6 rounded-xl border border-border bg-card/50 backdrop-blur-xl" style={{ boxShadow: 'var(--shadow-glass)' }}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-medium">
                    Scraped {result.items.length} items
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    From: {result.site}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCopyJSON} variant="outline" size="sm">
                  Copy JSON
                </Button>
                <Button onClick={handleDownloadJSON} size="sm">
                  Download JSON
                </Button>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-xl border border-border bg-card/50 backdrop-blur-xl" style={{ boxShadow: 'var(--shadow-glass)' }}>
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              JSON Output (Assignment Format)
            </h4>
            <ScrollArea className="h-[300px] w-full rounded-lg border border-border bg-background/50 p-4">
              <pre className="text-xs font-mono">
                <code>{JSON.stringify(result, null, 2)}</code>
              </pre>
            </ScrollArea>
          </div>

          <div className="p-6 rounded-xl border border-border bg-card/50 backdrop-blur-xl" style={{ boxShadow: 'var(--shadow-glass)' }}>
            <h4 className="text-sm font-medium mb-4">Content Preview</h4>
            <ScrollArea className="h-[400px] w-full">
              <div className="space-y-4 pr-4">
                {result.items.map((item, index) => (
                  <div
                    key={index}
                    className="p-5 rounded-xl border border-border bg-card/50 backdrop-blur-sm hover:bg-card hover:border-foreground/20 transition-all relative overflow-hidden group"
                  >
                    {/* Subtle shine on hover */}
                    <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none" />
                    
                    <div className="space-y-3 relative">
                      <div className="flex items-start justify-between gap-3">
                        <h4 className="font-medium text-foreground line-clamp-2 text-base">
                          {item.title}
                        </h4>
                        <Badge variant="secondary" className="shrink-0 text-xs rounded-md bg-muted border border-border/50">
                          {item.content_type}
                        </Badge>
                      </div>
                    
                      {item.source_url && (
                        <a
                          href={item.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 w-fit group/link"
                        >
                          <ExternalLink className="h-3 w-3 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
                          <span className="truncate max-w-[400px]">
                            {item.source_url}
                          </span>
                        </a>
                      )}

                      <div className="bg-background/50 rounded-lg p-4 border border-border/50">
                        <div className="prose prose-invert prose-sm max-w-none text-muted-foreground [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_h1]:text-foreground [&_h2]:text-foreground [&_h3]:text-foreground [&_strong]:text-foreground [&_a]:text-primary">
                          <ReactMarkdown>
                            {item.content.substring(0, 800)}
                          </ReactMarkdown>
                        </div>
                        {item.content.length > 800 && (
                          <p className="text-muted-foreground/60 mt-2">...</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      )}
    </div>
  );
};
