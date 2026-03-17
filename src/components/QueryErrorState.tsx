import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface QueryErrorStateProps {
  title: string;
  description: string;
  onRetry?: () => void;
}

export default function QueryErrorState({ title, description, onRetry }: QueryErrorStateProps) {
  return (
    <div className="flex min-h-[16rem] items-center justify-center">
      <Card className="w-full max-w-xl border-border">
        <CardContent className="flex flex-col gap-4 p-6">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>

          {onRetry && (
            <Button type="button" onClick={onRetry} className="w-fit">
              Skúsiť znova
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
