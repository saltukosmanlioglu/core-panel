'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  Divider,
  IconButton,
  LinearProgress,
  Skeleton,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Close as CloseIcon,
  DeleteOutline as DeleteOutlineIcon,
  Download as DownloadIcon,
  Fullscreen as FullscreenIcon,
  Replay as ReplayIcon,
  Visibility as VisibilityIcon,
  ViewInAr as ViewInArIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
} from '@mui/icons-material';
import type { ThreeDModel } from '@core-panel/shared';
import { GenerationStep } from '@core-panel/shared';
import { Notification } from '@/components';
import { ThreeDModelViewer } from '@/components/ThreeDModelViewer';
import { useSnackbar } from '@/hooks/useSnackbar';
import {
  deleteThreeDModelApi,
  generateThreeDModelFromImageApi,
  generateThreeDModelImagesApi,
  getProjectThreeDModelsApi,
  getThreeDModelStatusApi,
} from '@/services/3d-models/api';
import { getErrorMessage } from '@/utils/getErrorMessage';

const MAX_PROMPT_LENGTH = 600;
const WIZARD_STEPS = ['Tanım', 'Görsel Seç', '3D Model', 'Tamamlandı'];
const MODEL_STEPS = ['Görsel Alındı ✓', '3D Dönüşüm', 'Tamamlandı'];

const chipStyles: Record<GenerationStep, { label: string; bg: string; color: string; pulse?: boolean }> = {
  [GenerationStep.PENDING]: { label: 'Bekliyor', bg: '#f1f5f9', color: '#64748b' },
  [GenerationStep.IMAGE_GENERATING]: { label: 'Görsel Oluşturuluyor', bg: '#dbeafe', color: '#1d4ed8', pulse: true },
  [GenerationStep.IMAGE_DONE]: { label: 'Görsel Hazır', bg: '#dbeafe', color: '#1d4ed8' },
  [GenerationStep.MODEL_GENERATING]: { label: 'Model Oluşturuluyor', bg: '#ffedd5', color: '#c2410c', pulse: true },
  [GenerationStep.COMPLETED]: { label: 'Tamamlandı', bg: '#dcfce7', color: '#16a34a' },
  [GenerationStep.FAILED]: { label: 'Hata', bg: '#fee2e2', color: '#dc2626' },
};

type PollingState = { id: string };

function getModelUrl(model: ThreeDModel | null): string | null {
  return model?.modelUrl ?? model?.filePath ?? null;
}

function getPreviewImage(model: ThreeDModel): string | null {
  if (model.generationStep === GenerationStep.COMPLETED) {
    return model.thumbnailUrl ?? model.selectedImageUrl ?? model.previewImageUrls[0] ?? null;
  }

  return model.previewImageUrls[0] ?? model.selectedImageUrl ?? null;
}

function isGenerating(model: ThreeDModel): boolean {
  return (
    model.generationStep === GenerationStep.IMAGE_GENERATING ||
    model.generationStep === GenerationStep.MODEL_GENERATING
  );
}

export default function ModelPage() {
  const { id } = useParams<{ id: string }>();
  const [activeStep, setActiveStep] = useState(0);
  const [prompt, setPrompt] = useState('');
  const [models, setModels] = useState<ThreeDModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<ThreeDModel | null>(null);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageGenerating, setImageGenerating] = useState(false);
  const [modelStarting, setModelStarting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [polling, setPolling] = useState<PollingState | null>(null);
  const [viewerKey, setViewerKey] = useState(0);
  const viewerWrapRef = useRef<HTMLDivElement | null>(null);
  const { showSuccess, showError, notificationProps } = useSnackbar();

  const selectedModelUrl = getModelUrl(selectedModel);

  const selectImage = (imageUrl: string) => {
    setSelectedImageUrl(imageUrl);
    setLightboxImage(null);
  };

  const selectModel = useCallback((model: ThreeDModel | null) => {
    setSelectedModel(model);
    setSelectedImageUrl(model?.selectedImageUrl ?? null);

    if (!model) {
      return;
    }

    if (model.generationStep === GenerationStep.COMPLETED) {
      setActiveStep(3);
      return;
    }

    if (model.generationStep === GenerationStep.MODEL_GENERATING) {
      setActiveStep(2);
      setPolling({ id: model.id });
      return;
    }

    if (model.generationStep === GenerationStep.IMAGE_DONE) {
      setActiveStep(1);
      return;
    }

    if (model.generationStep === GenerationStep.FAILED) {
      setActiveStep(2);
    }
  }, []);

  const replaceModel = useCallback((updated: ThreeDModel) => {
    setModels((current) => current.map((model) => (model.id === updated.id ? updated : model)));
    setSelectedModel((current) => (current?.id === updated.id ? updated : current));
  }, []);

  const loadModels = useCallback(async (selectId?: string) => {
    const projectModels = await getProjectThreeDModelsApi(id);
    setModels(projectModels);

    const nextSelected = selectId
      ? projectModels.find((model) => model.id === selectId) ?? null
      : selectedModel
        ? projectModels.find((model) => model.id === selectedModel.id) ?? selectedModel
        : null;

    if (nextSelected) {
      selectModel(nextSelected);
    }

    const processing = projectModels.find((model) => model.generationStep === GenerationStep.MODEL_GENERATING);
    if (processing) {
      setPolling({ id: processing.id });
    }

    return projectModels;
  }, [id, selectModel, selectedModel]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        const projectModels = await getProjectThreeDModelsApi(id);

        if (!active) {
          return;
        }

        setModels(projectModels);
        const processing = projectModels.find((model) => model.generationStep === GenerationStep.MODEL_GENERATING);
        if (processing) {
          selectModel(processing);
          setPolling({ id: processing.id });
        }
      } catch (error) {
        if (active) {
          showError(getErrorMessage(error, 'Önceki modeller yüklenemedi'));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [id, selectModel]);

  useEffect(() => {
    if (!polling) {
      return undefined;
    }

    let active = true;

    const poll = async () => {
      try {
        const updated = await getThreeDModelStatusApi(polling.id);

        if (!active) {
          return;
        }

        replaceModel(updated);

        if (updated.generationStep === GenerationStep.COMPLETED) {
          setPolling(null);
          setModelStarting(false);
          setActiveStep(3);
          showSuccess('3D model hazır');
        }

        if (updated.generationStep === GenerationStep.FAILED) {
          setPolling(null);
          setModelStarting(false);
          showError('3D model oluşturma başarısız oldu');
        }
      } catch (error) {
        if (active) {
          setPolling(null);
          setModelStarting(false);
          showError(getErrorMessage(error, '3D model durumu alınamadı'));
        }
      }
    };

    void poll();
    const interval = window.setInterval(poll, 3000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [polling, replaceModel]);

  const handleGenerateImages = async () => {
    const trimmedPrompt = prompt.trim();

    if (!trimmedPrompt) {
      showError('Bina tanımı zorunludur');
      return;
    }

    try {
      setImageGenerating(true);
      setSelectedModel(null);
      setSelectedImageUrl(null);
      const response = await generateThreeDModelImagesApi(id, { prompt: trimmedPrompt });
      await loadModels(response.id);
      setSelectedImageUrl(null);
      setActiveStep(1);
      showSuccess('Görseller hazır');
    } catch (error) {
      showError(getErrorMessage(error, 'Görseller oluşturulamadı'));
    } finally {
      setImageGenerating(false);
    }
  };

  const handleGenerate3D = async () => {
    if (!selectedModel || !selectedImageUrl) {
      showError('3D modele çevirmek için bir görsel seçin');
      return;
    }

    try {
      setModelStarting(true);
      setActiveStep(2);
      const optimistic: ThreeDModel = {
        ...selectedModel,
        selectedImageUrl,
        generationStep: GenerationStep.MODEL_GENERATING,
        status: GenerationStep.MODEL_GENERATING,
        progress: 0,
      };
      replaceModel(optimistic);
      const response = await generateThreeDModelFromImageApi(selectedModel.id, selectedImageUrl);
      await loadModels(response.id);
      setPolling({ id: selectedModel.id });
    } catch (error) {
      setActiveStep(1);
      showError(getErrorMessage(error, '3D model oluşturma başlatılamadı'));
    } finally {
      setModelStarting(false);
    }
  };

  const handleDelete = async (model: ThreeDModel) => {
    try {
      setDeletingId(model.id);
      await deleteThreeDModelApi(model.id);
      setModels((current) => current.filter((item) => item.id !== model.id));
      if (selectedModel?.id === model.id) {
        setSelectedModel(null);
        setSelectedImageUrl(null);
        setActiveStep(0);
      }
      if (polling?.id === model.id) {
        setPolling(null);
      }
      showSuccess('3D model silindi');
    } catch (error) {
      showError(getErrorMessage(error, '3D model silinemedi'));
    } finally {
      setDeletingId(null);
    }
  };

  const handleNewModel = () => {
    setActiveStep(0);
    setPrompt('');
    setSelectedModel(null);
    setSelectedImageUrl(null);
    setLightboxImage(null);
  };

  const handleSaveModel = async () => {
    await loadModels(selectedModel?.id);
    showSuccess('Model galeriye kaydedildi');
  };

  const dispatchViewerWheel = (deltaY: number) => {
    const canvas = viewerWrapRef.current?.querySelector('canvas');
    canvas?.dispatchEvent(new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true }));
  };

  const requestViewerFullscreen = () => {
    void viewerWrapRef.current?.requestFullscreen();
  };

  const renderStepOne = () => (
    <Box sx={{ maxWidth: 700, mx: 'auto', py: 6 }}>
      <Typography variant="h5" fontWeight={800} textAlign="center" sx={{ mb: 0.75 }}>
        3D Model Oluştur
      </Typography>
      <Typography textAlign="center" color="text.secondary" sx={{ mb: 3 }}>
        Binanızı tarif edin, yapay zeka görselleştirsin
      </Typography>
      <TextField
        label="Bina Tanımı"
        placeholder="Örn: 4 bloklu site, her blok 10 katlı, merkezi bahçe, otopark çevresi..."
        value={prompt}
        onChange={(event) => setPrompt(event.target.value.slice(0, MAX_PROMPT_LENGTH))}
        multiline
        rows={6}
        fullWidth
        inputProps={{ maxLength: MAX_PROMPT_LENGTH }}
        helperText={`${prompt.length}/${MAX_PROMPT_LENGTH}`}
        FormHelperTextProps={{ sx: { textAlign: 'right', mr: 0 } }}
        sx={{
          mb: 2,
          '& .MuiOutlinedInput-root.Mui-focused fieldset': { borderColor: '#2D6A4F' },
          '& .MuiInputLabel-root.Mui-focused': { color: '#2D6A4F' },
        }}
      />
      <Button
        fullWidth
        variant="contained"
        disabled={imageGenerating || !prompt.trim()}
        onClick={handleGenerateImages}
        sx={{
          height: 52,
          bgcolor: '#2D6A4F',
          '&:hover': { bgcolor: '#52B788' },
          '&.Mui-disabled': { bgcolor: '#d1d5db', color: '#64748b' },
          textTransform: 'none',
          fontWeight: 800,
          fontSize: 15,
        }}
      >
        {imageGenerating ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={18} color="inherit" />
            Görseller oluşturuluyor...
          </Box>
        ) : (
          '✦ Görseller Oluştur'
        )}
      </Button>
      {imageGenerating && (
        <Box sx={{ mt: 2 }}>
          <LinearProgress sx={{ height: 6, borderRadius: 99, bgcolor: '#d8f3dc', '& .MuiLinearProgress-bar': { bgcolor: '#2D6A4F' } }} />
          <Typography sx={{ mt: 1, fontSize: 13, color: '#64748b' }}>
            Görseller oluşturuluyor... bu işlem ~30 saniye sürebilir
          </Typography>
        </Box>
      )}
    </Box>
  );

  const renderStepTwo = () => {
    const images = selectedModel?.previewImageUrls.slice(0, 5) ?? [];

    return (
      <Box sx={{ minHeight: 560, pb: 2 }}>
        <Typography variant="h5" fontWeight={800} textAlign="center" sx={{ mb: 0.75 }}>
          En iyi görseli seçin
        </Typography>
        <Typography textAlign="center" color="text.secondary" sx={{ mb: 3 }}>
          Seçtiğiniz görsel 3D modele dönüştürülecek
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(6, 1fr)' },
            gap: 2,
            maxWidth: 980,
            mx: 'auto',
          }}
        >
          {images.map((imageUrl, index) => {
            const isSelected = selectedImageUrl === imageUrl;
            return (
              <Box
                key={imageUrl}
                onClick={() => setLightboxImage(imageUrl)}
                onDoubleClick={() => selectImage(imageUrl)}
                sx={{
                  gridColumn: { md: index < 3 ? 'span 2' : 'span 3' },
                  aspectRatio: '1 / 1',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  border: `2px solid ${isSelected ? '#2D6A4F' : 'transparent'}`,
                  position: 'relative',
                  transition: 'transform 0.18s ease, border-color 0.18s ease',
                  '&:hover': {
                    borderColor: '#52B788',
                    transform: 'scale(1.02)',
                  },
                  '&:hover .zoom-overlay': { opacity: 1 },
                }}
              >
                <Box
                  component="img"
                  src={imageUrl}
                  alt="3D modele çevrilecek bina görseli"
                  sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                <Box
                  className="zoom-overlay"
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    bgcolor: 'rgba(0,0,0,0.24)',
                    opacity: 0,
                    transition: 'opacity 0.18s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ZoomInIcon sx={{ color: 'white', fontSize: 36 }} />
                </Box>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    const link = document.createElement('a');
                    link.href = imageUrl;
                    link.download = `architectural-render-${index + 1}.png`;
                    link.click();
                  }}
                  sx={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    bgcolor: 'rgba(0,0,0,0.6)',
                    borderRadius: '50%',
                    color: 'white',
                    '&:hover': { bgcolor: 'rgba(0,0,0,0.85)' },
                  }}
                >
                  <DownloadIcon sx={{ fontSize: 16 }} />
                </IconButton>
                {isSelected && (
                  <Box sx={{ position: 'absolute', top: 10, right: 10, width: 34, height: 34, borderRadius: '50%', bgcolor: '#2D6A4F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CheckCircleIcon sx={{ color: 'white', fontSize: 22 }} />
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
        <Box
          sx={{
            position: 'sticky',
            bottom: 0,
            mt: 3,
            py: 2,
            bgcolor: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid #e2e8f0',
          }}
        >
          <Button onClick={() => setActiveStep(0)} sx={{ color: '#475569', textTransform: 'none', fontWeight: 700 }}>
            ← Geri
          </Button>
          <Button
            variant="contained"
            disabled={!selectedImageUrl || modelStarting}
            onClick={() => void handleGenerate3D()}
            sx={{
              height: 48,
              px: 4,
              bgcolor: '#2D6A4F',
              '&:hover': { bgcolor: '#52B788' },
              '&.Mui-disabled': { bgcolor: '#d1d5db', color: '#64748b' },
              textTransform: 'none',
              fontWeight: 800,
            }}
          >
            {modelStarting ? <CircularProgress size={18} color="inherit" /> : '3D Modele Çevir →'}
          </Button>
        </Box>
      </Box>
    );
  };

  const renderStepThree = () => {
    const progress = selectedModel?.progress ?? 0;

    return (
      <Box sx={{ minHeight: 560, bgcolor: '#1A1A2E', borderRadius: 3, p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
        {selectedImageUrl && (
          <Box sx={{ textAlign: 'center' }}>
            <Box component="img" src={selectedImageUrl} alt="Seçilen görsel" sx={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 2, border: '2px solid rgba(255,255,255,0.2)' }} />
            <Typography sx={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, mt: 1 }}>
              Seçilen görsel
            </Typography>
          </Box>
        )}
        <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress size={100} thickness={3} sx={{ color: '#52B788' }} />
          <Typography sx={{ position: 'absolute', color: 'white', fontSize: 24, fontWeight: 800 }}>
            % {progress}
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'center' }}>
          <Typography sx={{ color: 'white', fontSize: 22, fontWeight: 800 }}>
            3D model oluşturuluyor...
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, mt: 0.5 }}>
            Meshy modeli GLB formatına dönüştürüyor
          </Typography>
        </Box>
        <Stepper
          activeStep={1}
          alternativeLabel
          sx={{
            width: 'min(640px, 100%)',
            '& .MuiStepLabel-label': { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
            '& .MuiStepLabel-label.Mui-active': { color: 'white', fontWeight: 700 },
            '& .MuiStepLabel-label.Mui-completed': { color: 'rgba(255,255,255,0.7)' },
            '& .MuiStepIcon-root': { color: 'rgba(255,255,255,0.2)' },
            '& .MuiStepIcon-root.Mui-active': { color: '#52B788' },
            '& .MuiStepIcon-root.Mui-completed': { color: '#52B788' },
            '& .MuiStepConnector-line': { borderColor: 'rgba(255,255,255,0.2)' },
          }}
        >
          {MODEL_STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
        {selectedModel?.generationStep === GenerationStep.FAILED && (
          <Button
            variant="contained"
            onClick={() => void handleGenerate3D()}
            sx={{ bgcolor: '#2D6A4F', '&:hover': { bgcolor: '#52B788' }, textTransform: 'none', fontWeight: 800 }}
          >
            Tekrar Dene
          </Button>
        )}
      </Box>
    );
  };

  const renderStepFour = () => (
    <Box sx={{ width: '100%' }}>
      <Card
        ref={viewerWrapRef}
        sx={{
          position: 'relative',
          width: '100%',
          height: '65vh',
          background: '#1A1A2E',
          borderRadius: '16px',
          overflow: 'hidden',
          border: 0,
          boxShadow: 'none',
        }}
      >
        {selectedModelUrl && selectedModel ? (
          <>
            <Box sx={{ width: '100%', height: '100%', display: 'block', background: '#1A1A2E' }}>
              <ThreeDModelViewer key={`${selectedModel.id}-${viewerKey}`} modelUrl={selectedModelUrl} fileName={`${selectedModel.modelName ?? 'model'}.glb`} />
            </Box>
            <Box
              sx={{
                position: 'absolute',
                left: '50%',
                bottom: 18,
                transform: 'translateX(-50%)',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                bgcolor: 'rgba(0,0,0,0.65)',
                backdropFilter: 'blur(12px)',
                borderRadius: '50px',
                px: 3,
                py: 1,
                zIndex: 2,
              }}
            >
              <IconButton size="small" onClick={() => dispatchViewerWheel(-160)} sx={{ color: 'white', '&:hover': { color: '#52B788' } }}>
                <ZoomInIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" onClick={() => dispatchViewerWheel(160)} sx={{ color: 'white', '&:hover': { color: '#52B788' } }}>
                <ZoomOutIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" onClick={() => setViewerKey((value) => value + 1)} sx={{ color: 'white', '&:hover': { color: '#52B788' } }}>
                <ReplayIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" onClick={requestViewerFullscreen} sx={{ color: 'white', '&:hover': { color: '#52B788' } }}>
                <FullscreenIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" component="a" href={selectedModelUrl} download={`${selectedModel.modelName ?? 'model'}.glb`} sx={{ color: 'white', '&:hover': { color: '#52B788' } }}>
                <DownloadIcon fontSize="small" />
              </IconButton>
            </Box>
          </>
        ) : (
          <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'rgba(255,255,255,0.6)' }}>
            <ViewInArIcon sx={{ fontSize: 72, mb: 1 }} />
            <Typography>Model görüntülenemiyor</Typography>
          </Box>
        )}
      </Card>
      <Box sx={{ mt: 2.5, display: 'flex', gap: 1.5, justifyContent: 'center' }}>
        <Button variant="outlined" onClick={handleNewModel} sx={{ borderColor: '#2D6A4F', color: '#2D6A4F', textTransform: 'none', fontWeight: 800 }}>
          Yeni Model Oluştur
        </Button>
        <Button variant="contained" onClick={() => void handleSaveModel()} sx={{ bgcolor: '#2D6A4F', '&:hover': { bgcolor: '#52B788' }, textTransform: 'none', fontWeight: 800 }}>
          Modeli Kaydet
        </Button>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'grid', gap: 3 }}>
      <Stepper
        activeStep={activeStep}
        alternativeLabel
        sx={{
          '& .MuiStepIcon-root.Mui-active': { color: '#2D6A4F' },
          '& .MuiStepIcon-root.Mui-completed': { color: '#52B788' },
          '& .MuiStepLabel-label.Mui-active': { fontWeight: 800 },
        }}
      >
        {WIZARD_STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Box>
        {activeStep === 0 && renderStepOne()}
        {activeStep === 1 && renderStepTwo()}
        {activeStep === 2 && renderStepThree()}
        {activeStep === 3 && renderStepFour()}
      </Box>

      <Divider />

      <Box>
        <Typography sx={{ fontSize: 18, fontWeight: 800, color: '#111827', mb: 1.5 }}>
          Önceki Modeller
        </Typography>
        {loading ? (
          <Box sx={{ display: 'flex', gap: 2, overflow: 'hidden' }}>
            {[0, 1, 2].map((item) => (
              <Skeleton key={item} variant="rectangular" width={200} height={230} sx={{ borderRadius: 2, flexShrink: 0 }} />
            ))}
          </Box>
        ) : models.length === 0 ? (
          <Typography sx={{ fontSize: 13, color: '#64748b' }}>
            Henüz model oluşturulmadı.
          </Typography>
        ) : (
          <Box
            sx={{
              display: 'flex',
              gap: 2,
              overflowX: 'auto',
              pb: 1,
              scrollbarWidth: 'none',
              '&::-webkit-scrollbar': { display: 'none' },
            }}
          >
            {models.map((model) => {
              const style = chipStyles[model.generationStep] ?? chipStyles[GenerationStep.PENDING];
              const isSelected = selectedModel?.id === model.id;
              const image = getPreviewImage(model);

              return (
                <Card
                  key={model.id}
                  onClick={() => selectModel(model)}
                  sx={{
                    width: 200,
                    minWidth: 200,
                    borderRadius: 2,
                    border: isSelected ? '2px solid #52B788' : '1px solid #e2e8f0',
                    boxShadow: isSelected ? '0 0 0 3px rgba(82,183,136,0.16)' : '0 1px 3px rgba(15,23,42,0.08)',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    position: 'relative',
                    transition: 'transform 0.18s ease, box-shadow 0.18s ease',
                    '&:hover': {
                      transform: 'translateY(-3px)',
                      boxShadow: '0 10px 24px rgba(15,23,42,0.12)',
                    },
                    '&:hover .gallery-actions': { opacity: 1 },
                  }}
                >
                  <Box sx={{ height: 130, bgcolor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {isGenerating(model) ? (
                      <Skeleton variant="rectangular" width="100%" height="100%" />
                    ) : image ? (
                      <Box component="img" src={image} alt={model.modelName ?? '3D model'} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <ViewInArIcon sx={{ fontSize: 42, color: '#94a3b8' }} />
                    )}
                  </Box>
                  <CardContent sx={{ p: 1.5, pb: 1 }}>
                    <Typography noWrap sx={{ fontSize: 13, fontWeight: 800, color: '#111827', mb: 0.5 }}>
                      {model.modelName ?? '3D Model'}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: '#94a3b8', mb: 1 }}>
                      {new Date(model.createdAt).toLocaleDateString('tr-TR')}
                    </Typography>
                    <Chip
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                          {style.pulse && (
                            <Box
                              sx={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                bgcolor: style.color,
                                '@keyframes pulseDot': {
                                  '0%, 100%': { opacity: 1 },
                                  '50%': { opacity: 0.35 },
                                },
                                animation: 'pulseDot 1.2s ease-in-out infinite',
                              }}
                            />
                          )}
                          {style.label}
                        </Box>
                      }
                      size="small"
                      sx={{ height: 24, bgcolor: style.bg, color: style.color, fontSize: 11, fontWeight: 700 }}
                    />
                  </CardContent>
                  <CardActions
                    className="gallery-actions"
                    onClick={(event) => event.stopPropagation()}
                    sx={{ opacity: 0, transition: 'opacity 0.18s ease', px: 1.2, pb: 1.2, pt: 0, justifyContent: 'flex-end' }}
                  >
                    <Tooltip title="Sil">
                      <span>
                        <IconButton size="small" disabled={deletingId === model.id} onClick={() => void handleDelete(model)} sx={{ color: '#dc2626' }}>
                          {deletingId === model.id ? <CircularProgress size={16} /> : <DeleteOutlineIcon fontSize="small" />}
                        </IconButton>
                      </span>
                    </Tooltip>
                  </CardActions>
                </Card>
              );
            })}
          </Box>
        )}
      </Box>

      <Dialog
        open={Boolean(lightboxImage)}
        onClose={() => setLightboxImage(null)}
        fullScreen
        PaperProps={{ sx: { bgcolor: '#1A1A2E' } }}
      >
        <DialogContent
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 3,
            position: 'relative',
            bgcolor: '#1A1A2E',
          }}
        >
          <IconButton onClick={() => setLightboxImage(null)} sx={{ position: 'absolute', top: 16, right: 16, color: 'white' }}>
            <CloseIcon />
          </IconButton>
          {lightboxImage && (
            <img
              src={lightboxImage}
              alt="preview"
              style={{
                maxWidth: '90vw',
                maxHeight: '80vh',
                objectFit: 'contain',
                borderRadius: '8px',
              }}
            />
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', gap: 1.5, p: 3, bgcolor: 'rgba(0,0,0,0.35)' }}>
          <Button onClick={() => setLightboxImage(null)} sx={{ color: 'white', textTransform: 'none', fontWeight: 700 }}>
            Kapat
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={() => {
              if (!lightboxImage) return;
              const idx = selectedModel?.previewImageUrls.indexOf(lightboxImage) ?? 0;
              const link = document.createElement('a');
              link.href = lightboxImage;
              link.download = `architectural-render-${idx + 1}.png`;
              link.click();
            }}
            sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.5)', textTransform: 'none', fontWeight: 700, '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.08)' } }}
          >
            İndir
          </Button>
          <Button
            variant="contained"
            onClick={() => lightboxImage && selectImage(lightboxImage)}
            sx={{ bgcolor: '#2D6A4F', '&:hover': { bgcolor: '#52B788' }, textTransform: 'none', fontWeight: 800 }}
          >
            Bu Görseli Seç
          </Button>
        </DialogActions>
      </Dialog>

      <Notification {...notificationProps} />
    </Box>
  );
}
