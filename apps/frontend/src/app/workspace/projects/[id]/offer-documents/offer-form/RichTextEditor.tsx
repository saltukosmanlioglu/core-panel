'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { Box, IconButton, Divider, Tooltip } from '@mui/material';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import TitleIcon from '@mui/icons-material/Title';
import NotesIcon from '@mui/icons-material/Notes';
import FormatClearIcon from '@mui/icons-material/FormatClear';

interface RichTextEditorProps {
  initialValue: string;
  onChange: (html: string) => void;
}

export function RichTextEditor({ initialValue, onChange }: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit, Underline],
    content: initialValue,
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML());
    },
  });

  if (!editor) return null;

  const ToolbarBtn = ({
    title,
    active,
    onClick,
    children,
  }: {
    title: string;
    active?: boolean;
    onClick: () => void;
    children: React.ReactNode;
  }) => (
    <Tooltip title={title}>
      <IconButton
        size="small"
        onClick={onClick}
        sx={{
          borderRadius: 1,
          bgcolor: active ? 'action.selected' : 'transparent',
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        {children}
      </IconButton>
    </Tooltip>
  );

  return (
    <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, overflow: 'hidden' }}>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 0.5,
          p: 0.75,
          borderBottom: '1px solid #e0e0e0',
          bgcolor: '#fafafa',
        }}
      >
        <ToolbarBtn
          title="Kalın (Bold)"
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <FormatBoldIcon fontSize="small" />
        </ToolbarBtn>
        <ToolbarBtn
          title="İtalik"
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <FormatItalicIcon fontSize="small" />
        </ToolbarBtn>
        <ToolbarBtn
          title="Altı Çizili"
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <FormatUnderlinedIcon fontSize="small" />
        </ToolbarBtn>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        <ToolbarBtn
          title="Başlık 1"
          active={editor.isActive('heading', { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          <TitleIcon fontSize="small" />
        </ToolbarBtn>
        <ToolbarBtn
          title="Başlık 2"
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <TitleIcon fontSize="small" sx={{ fontSize: 16 }} />
        </ToolbarBtn>
        <ToolbarBtn
          title="Paragraf"
          active={editor.isActive('paragraph')}
          onClick={() => editor.chain().focus().setParagraph().run()}
        >
          <NotesIcon fontSize="small" />
        </ToolbarBtn>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        <ToolbarBtn
          title="Madde Listesi"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <FormatListBulletedIcon fontSize="small" />
        </ToolbarBtn>
        <ToolbarBtn
          title="Numaralı Liste"
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <FormatListNumberedIcon fontSize="small" />
        </ToolbarBtn>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        <ToolbarBtn
          title="Biçimlendirmeyi Temizle"
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
        >
          <FormatClearIcon fontSize="small" />
        </ToolbarBtn>
      </Box>

      <Box
        sx={{
          minHeight: 500,
          p: 2,
          '& .ProseMirror': {
            minHeight: 460,
            outline: 'none',
            fontSize: 14,
            lineHeight: 1.7,
            '& ul, & ol': { pl: 3 },
            '& li': { mb: 0.25 },
            '& h1': { fontSize: '1.4em', fontWeight: 700, my: 1 },
            '& h2': { fontSize: '1.15em', fontWeight: 700, my: 0.75 },
            '& p': { my: 0.5 },
          },
        }}
      >
        <EditorContent editor={editor} />
      </Box>
    </Box>
  );
}
