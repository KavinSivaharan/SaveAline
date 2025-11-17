import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, Copy, ExternalLink, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from 'date-fns';

interface ScrapeJob {
  id: string;
  url: string;
  status: string;
  progress: number;
  total: number;
  created_at: string;
  result: {
    site: string;
    items: Array<{
      title: string;
      content: string;
      content_type: string;
      source_url: string;
    }>;
    scraped: number;
    total: number;
  } | null;
}

export const ScrapeHistory = () => {
  const { toast } = useToast();
  const [jobs, setJobs] = useState<ScrapeJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<ScrapeJob | null>(null);

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('scrape_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error loading jobs:', error);
      toast({
        title: "Error",
        description: "Failed to load scrape history",
        variant: "destructive",
      });
    } else {
      setJobs((data || []) as unknown as ScrapeJob[]);
    }
    setIsLoading(false);
  };

  const handleCopyJSON = (job: ScrapeJob) => {
    if (!job.result) return;
    const output = {
      site: job.result.site,
      items: job.result.items
    };
    navigator.clipboard.writeText(JSON.stringify(output, null, 2));
    toast({
      title: "Copied!",
      description: "JSON output copied to clipboard",
    });
  };

  const handleDownloadJSON = (job: ScrapeJob) => {
    if (!job.result) return;
    const output = {
      site: job.result.site,
      items: job.result.items
    };
    const dataStr = JSON.stringify(output, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `scrape-${job.id.substring(0, 8)}-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({
      title: "Downloaded!",
      description: "JSON file downloaded successfully",
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'processing':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'partial':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Scrape History</h2>
        <Button onClick={loadJobs} variant="outline" size="sm">
          Refresh
        </Button>
      </div>

      <ScrollArea className="h-[600px]">
        <div className="space-y-3 pr-4">
          {jobs.map((job) => (
            <Card key={job.id} className="border-border hover:border-foreground/20 transition-all">
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {getStatusIcon(job.status)}
                        <Badge variant="secondary" className="text-xs">
                          {job.status}
                        </Badge>
                        {job.result && (
                          <span className="text-sm text-muted-foreground">
                            {job.result.scraped} items
                          </span>
                        )}
                      </div>
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium hover:text-primary transition-colors flex items-center gap-1.5 truncate group"
                      >
                        <ExternalLink className="h-3 w-3 shrink-0 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        <span className="truncate">{job.url}</span>
                      </a>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    
                    {job.result && job.result.items && job.result.items.length > 0 && (
                      <div className="flex gap-2 shrink-0">
                        <Button 
                          onClick={() => handleCopyJSON(job)} 
                          variant="outline" 
                          size="sm"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button 
                          onClick={() => handleDownloadJSON(job)} 
                          size="sm"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {job.result && job.result.items && job.result.items.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <details className="group">
                        <summary className="text-sm font-medium cursor-pointer hover:text-primary transition-colors list-none flex items-center gap-2">
                          <span className="group-open:rotate-90 transition-transform">▶</span>
                          View {job.result.items.length} items
                        </summary>
                        <ScrollArea className="h-[200px] mt-3">
                          <div className="space-y-2 pr-3">
                            {job.result.items.map((item, idx) => (
                              <div key={idx} className="p-3 rounded-lg bg-muted/50 border border-border">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{item.title}</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {item.content_type}
                                    </p>
                                  </div>
                                  <a
                                    href={item.source_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </details>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          {jobs.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No scrape history yet
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};