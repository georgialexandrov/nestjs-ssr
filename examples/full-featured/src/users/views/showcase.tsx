import React, { useState } from 'react';
import { Button } from '@/shared/views/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/views/components/ui/dialog';
import type { PageProps } from '@nestjs-ssr/react';

interface ShowcaseData {
  title: string;
  description: string;
}

export default function ShowcaseView({ data }: PageProps<ShowcaseData>) {
  const [count, setCount] = useState(0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
            {data.title} - Hot Module Replacement Working!
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {data.description}
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto mb-12">
          {/* shadcn/ui Components Card */}
          <div className="bg-card rounded-lg border shadow-sm p-8">
            <h2 className="text-2xl font-semibold mb-6">
              shadcn/ui Components
            </h2>
            <div className="space-y-6">
              {/* Buttons */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  Buttons
                </h3>
                <div className="flex flex-wrap gap-3">
                  <Button>Default</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="destructive">Destructive</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="link">Link</Button>
                </div>
              </div>

              {/* Dialog */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  Dialog (Modal)
                </h3>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="text-red-600">
                      Open Dialog
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-white">
                    <DialogHeader>
                      <DialogTitle>Welcome to NestJS + React SSR!</DialogTitle>
                      <DialogDescription>
                        This is a fully functional dialog component from
                        shadcn/ui. It works seamlessly with server-side
                        rendering and includes accessibility features out of the
                        box.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                      <p className="text-sm text-muted-foreground">
                        The dialog is built with Radix UI and styled with
                        Tailwind CSS. It supports keyboard navigation, focus
                        trapping, and ARIA attributes.
                      </p>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Counter */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  Interactive State
                </h3>
                <div className="flex items-center gap-4">
                  <Button
                    onClick={() => setCount(count - 1)}
                    variant="outline"
                    size="icon"
                  >
                    -
                  </Button>
                  <span className="text-2xl font-bold tabular-nums w-16 text-center">
                    {count}
                  </span>
                  <Button
                    onClick={() => setCount(count + 1)}
                    variant="outline"
                    size="icon"
                  >
                    +
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Hydration complete! Client-side state management works
                  perfectly.
                </p>
              </div>
            </div>
          </div>

          {/* Image & Styling Card */}
          <div className="bg-card rounded-lg border shadow-sm p-8">
            <h2 className="text-2xl font-semibold mb-6">Static Assets</h2>
            <div className="space-y-6">
              {/* Image */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  Images from /public
                </h3>
                <div className="rounded-lg overflow-hidden border">
                  <img
                    src="/images/sample.jpg"
                    alt="Sample from Unsplash"
                    className="w-full h-48 object-cover"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Served from /public/images directory
                </p>
              </div>

              {/* Typography */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  Google Fonts (Inter)
                </h3>
                <div className="space-y-2">
                  <p className="font-normal">Regular weight (400)</p>
                  <p className="font-medium">Medium weight (500)</p>
                  <p className="font-semibold">Semibold weight (600)</p>
                  <p className="font-bold">Bold weight (700)</p>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Inter font loaded from Google Fonts
                </p>
              </div>

              {/* Tailwind CSS */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  Tailwind CSS
                </h3>
                <div className="grid grid-cols-4 gap-2">
                  <div className="h-12 rounded bg-primary"></div>
                  <div className="h-12 rounded bg-secondary"></div>
                  <div className="h-12 rounded bg-accent"></div>
                  <div className="h-12 rounded bg-muted"></div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Custom color scheme with CSS variables
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground">
          <p>Built with NestJS, React 19, Vite, Tailwind CSS, and shadcn/ui</p>
          <p className="mt-2">Server-Side Rendering + Client Hydration ✨</p>
        </div>
      </div>
    </div>
  );
}
