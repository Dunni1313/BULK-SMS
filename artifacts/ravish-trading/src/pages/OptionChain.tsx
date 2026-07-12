import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useGetOptionChain, useGetExpirations, useGetUniverse } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

export default function OptionChain() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const symbol = params.symbol?.toUpperCase() || "SPY";
  const [open, setOpen] = useState(false);

  const { data: universe } = useGetUniverse();
  const { data: chain, isLoading } = useGetOptionChain(symbol);

  // Group strikes
  const strikes = Array.from(new Set([
    ...(chain?.calls || []).map(c => c.strike),
    ...(chain?.puts || []).map(p => p.strike)
  ])).sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" aria-expanded={open} className="w-[150px] justify-between font-mono bg-card border-border">
                {symbol}
                <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0 bg-card border-border">
              <Command>
                <CommandInput placeholder="Search symbol..." />
                <CommandList>
                  <CommandEmpty>No symbol found.</CommandEmpty>
                  <CommandGroup>
                    {universe?.map((u) => (
                      <CommandItem
                        key={u.symbol}
                        value={u.symbol}
                        onSelect={(currentValue) => {
                          setLocation(`/options/${currentValue}`);
                          setOpen(false);
                        }}
                        className="font-mono"
                      >
                        {u.symbol}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          
          {chain && (
            <div className="flex gap-4 text-sm font-mono items-center">
              <span className="text-muted-foreground">LAST:</span>
              <span className="text-lg font-bold">${chain.underlyingPrice.toFixed(2)}</span>
              <span className="text-muted-foreground ml-4">IVR:</span>
              <span className={chain.ivRank > 50 ? "text-success" : "text-muted-foreground"}>{chain.ivRank.toFixed(1)}</span>
            </div>
          )}
        </div>
      </div>

      <Card className="bg-card border-border overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead colSpan={6} className="text-center border-r border-border font-bold">CALLS</TableHead>
                  <TableHead className="text-center font-bold bg-muted/20 w-[100px]">STRIKE</TableHead>
                  <TableHead colSpan={6} className="text-center border-l border-border font-bold">PUTS</TableHead>
                </TableRow>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-right text-xs text-muted-foreground">DELTA</TableHead>
                  <TableHead className="text-right text-xs text-muted-foreground">THETA</TableHead>
                  <TableHead className="text-right text-xs text-muted-foreground">IV</TableHead>
                  <TableHead className="text-right text-xs text-muted-foreground">BID</TableHead>
                  <TableHead className="text-right text-xs text-muted-foreground">MID</TableHead>
                  <TableHead className="text-right text-xs text-muted-foreground border-r border-border">ASK</TableHead>
                  
                  <TableHead className="text-center bg-muted/20"></TableHead>
                  
                  <TableHead className="text-left text-xs text-muted-foreground border-l border-border">BID</TableHead>
                  <TableHead className="text-left text-xs text-muted-foreground">MID</TableHead>
                  <TableHead className="text-left text-xs text-muted-foreground">ASK</TableHead>
                  <TableHead className="text-left text-xs text-muted-foreground">IV</TableHead>
                  <TableHead className="text-left text-xs text-muted-foreground">THETA</TableHead>
                  <TableHead className="text-left text-xs text-muted-foreground">DELTA</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i} className="border-border">
                      <TableCell colSpan={13}><Skeleton className="h-6 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : (
                  strikes.map(strike => {
                    const call = chain?.calls.find(c => c.strike === strike);
                    const put = chain?.puts.find(p => p.strike === strike);
                    const isItmCall = chain ? strike < chain.underlyingPrice : false;
                    const isItmPut = chain ? strike > chain.underlyingPrice : false;

                    return (
                      <TableRow key={strike} className="border-border hover:bg-secondary/30 font-mono text-sm">
                        <TableCell className={`text-right ${isItmCall ? 'bg-primary/10' : ''}`}>{call?.delta.toFixed(2)}</TableCell>
                        <TableCell className={`text-right ${isItmCall ? 'bg-primary/10' : ''}`}>{call?.theta.toFixed(3)}</TableCell>
                        <TableCell className={`text-right ${isItmCall ? 'bg-primary/10' : ''}`}>{(call?.iv || 0 * 100).toFixed(1)}%</TableCell>
                        <TableCell className={`text-right ${isItmCall ? 'bg-primary/10' : ''}`}>{call?.bid.toFixed(2)}</TableCell>
                        <TableCell className={`text-right font-bold ${isItmCall ? 'bg-primary/10' : ''}`}>{call?.mid?.toFixed(2) || ((call?.bid||0) + (call?.ask||0))/2}</TableCell>
                        <TableCell className={`text-right border-r border-border ${isItmCall ? 'bg-primary/10' : ''}`}>{call?.ask.toFixed(2)}</TableCell>
                        
                        <TableCell className="text-center font-bold bg-muted/20">{strike.toFixed(1)}</TableCell>
                        
                        <TableCell className={`text-left border-l border-border ${isItmPut ? 'bg-primary/10' : ''}`}>{put?.bid.toFixed(2)}</TableCell>
                        <TableCell className={`text-left font-bold ${isItmPut ? 'bg-primary/10' : ''}`}>{put?.mid?.toFixed(2) || ((put?.bid||0) + (put?.ask||0))/2}</TableCell>
                        <TableCell className={`text-left ${isItmPut ? 'bg-primary/10' : ''}`}>{put?.ask.toFixed(2)}</TableCell>
                        <TableCell className={`text-left ${isItmPut ? 'bg-primary/10' : ''}`}>{(put?.iv || 0 * 100).toFixed(1)}%</TableCell>
                        <TableCell className={`text-left ${isItmPut ? 'bg-primary/10' : ''}`}>{put?.theta.toFixed(3)}</TableCell>
                        <TableCell className={`text-left ${isItmPut ? 'bg-primary/10' : ''}`}>{put?.delta.toFixed(2)}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
