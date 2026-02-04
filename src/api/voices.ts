import apiClient from './client';

export interface VoiceProfile {
    name: string;
}

export interface VoiceGenerateRequest {
    text: string;
    voice_name: string;
    language?: string;
}

export interface BatchVoiceGenerateRequest {
    texts: string[];
    voice_name: string;
    language?: string;
}

export const saveVoice = async (name: string, referenceText: string, referenceAudio: File) => {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('reference_text', referenceText);
    formData.append('reference_audio', referenceAudio);

    return apiClient.post('/api/voices/save', formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    });
};

export const getVoices = async () => {
    return apiClient.get<string[]>('/api/voices/list');
};

export const generateVoice = async (req: VoiceGenerateRequest) => {
    return apiClient.post('/api/voices/generate', req, { responseType: 'blob' });
};

export const generateBatchVoice = async (req: BatchVoiceGenerateRequest) => {
    return apiClient.post<{ [key: string]: string }>('/api/voices/generate/batch', req);
};

export const getVoicePreview = async (name: string) => {
    return apiClient.get(`/api/voices/${encodeURIComponent(name)}/preview`, { 
        responseType: 'blob' 
    });
};

export const deleteVoice = async (name: string) => {
    return apiClient.delete(`/api/voices/${encodeURIComponent(name)}`);
};
