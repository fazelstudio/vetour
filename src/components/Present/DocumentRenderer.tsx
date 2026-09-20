/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  DocumentRenderer.tsx
 *  Document preview for PDF, markdown, text, and office formats.
 *-----------------------------------------------------------------------------------------------*/

import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Papa from 'papaparse';
import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { Loader2 } from 'lucide-react';
import { getDocumentExtension } from '@/lib/documentRenderers';
import { command } from '@/commands';

interface DocumentRendererProps {
  src: string;
  title: string;
}

export function DocumentRenderer({ src, title }: DocumentRendererProps) {
  const [content, setContent] = useState<React.ReactNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const extension = getDocumentExtension(src);

  useEffect(() => {
    let isMounted = true;

    const loadDocument = async () => {
      setLoading(true);
      setError(null);
      
      try {
        if (extension === 'pdf') {
          // PDFs render natively in an iframe with the toolbar hidden.
          setContent(
            <div className="w-[800px] max-w-full h-[600px]">
              <iframe
                src={`${src}#toolbar=0&navpanes=0`}
                className="w-full h-full border-0"
                title={title}
              />
            </div>
          );
          return;
        }

        const response = await fetch(src);
        if (!response.ok) throw new Error('Failed to load document');

        if (extension === 'md') {
          const text = await response.text();
          setContent(
            <div className="prose prose-sm max-w-none p-6 break-words">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
            </div>
          );
        } else if (extension === 'txt') {
          const text = await response.text();
          setContent(
            <div className="p-6">
              <pre className="text-sm whitespace-pre-wrap font-sans text-gray-800 break-words">
                {text}
              </pre>
            </div>
          );
        } else if (extension === 'csv') {
          const text = await response.text();
          Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
              if (results.data.length === 0) {
                setContent(<div className="p-6">CSV is empty</div>);
                return;
              }
              const headers = Object.keys(results.data[0] as object);
              setContent(
                <div className="p-6">
                  <table className="min-w-full divide-y divide-gray-200 border">
                    <thead className="bg-gray-50">
                      <tr>
                        {headers.map((h, i) => (
                          <th key={i} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-x">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {(results.data as Record<string, unknown>[]).map((row, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          {headers.map((h, j) => (
                            <td key={j} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-x">
                              {String(row[h] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            }
          });
        } else if (extension === 'docx') {
          const arrayBuffer = await response.arrayBuffer();
          const result = await mammoth.convertToHtml({ arrayBuffer });
          setContent(
            <div 
              className="prose prose-sm max-w-none p-6 break-words"
              dangerouslySetInnerHTML={{ __html: result.value }} 
            />
          );
        } else if (extension === 'xlsx') {
          const arrayBuffer = await response.arrayBuffer();
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const html = XLSX.utils.sheet_to_html(worksheet);
          setContent(
            <div className="p-6">
              <div 
                className="prose max-w-none [&>table]:min-w-full [&>table]:border-collapse [&>table>tbody>tr>td]:border [&>table>tbody>tr>td]:p-2 break-words"
                dangerouslySetInnerHTML={{ __html: html }} 
              />
            </div>
          );
        } else {
          // Ask installed extensions before falling back to the unsupported notice.
          const handler = extension
            ? (command('media.document.resolve-handler', { extension }) as { handler: string; extensionId?: string } | null)
            : null;
          if (handler?.handler === 'extension') {
            setContent(
              <div className="p-6 flex flex-col items-center justify-center h-full">
                <p>Format .{extension} is provided by extension {handler.extensionId}.</p>
                <p className="text-sm mt-2 text-gray-500">Update the extension to enable in-viewer rendering.</p>
              </div>
            );
          } else {
            setContent(
              <div className="p-6 text-red-500 flex flex-col items-center justify-center h-full">
                <p>Unsupported document format: .{extension}</p>
                <p className="text-sm mt-2 text-gray-500">Please convert this file to PDF before importing.</p>
              </div>
            );
          }
        }
      } catch (err) {
        console.error('Error rendering document:', err);
        setError(String(err));
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadDocument();

    return () => {
      isMounted = false;
    };
  }, [src, extension, title]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-white rounded-lg">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm text-gray-500">Rendering document...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-white rounded-lg">
        <div className="text-red-500 text-center p-4">
          <p className="font-semibold mb-2">Failed to load document</p>
          <p className="text-sm opacity-80">{error}</p>
        </div>
      </div>
    );
  }

  return <>{content}</>;
}
