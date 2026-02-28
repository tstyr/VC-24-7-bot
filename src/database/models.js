import mongoose from 'mongoose';

const voiceLogSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  username: { type: String, required: true },
  guildId: { type: String, required: true },
  channelId: { type: String, required: true },
  channelName: { type: String, required: true },
  action: { type: String, enum: ['join', 'leave'], required: true },
  timestamp: { type: Date, default: Date.now }
});

voiceLogSchema.index({ guildId: 1, timestamp: -1 });

export const VoiceLog = mongoose.model('VoiceLog', voiceLogSchema);

export async function connectDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB接続成功');
  } catch (error) {
    console.error('❌ MongoDB接続エラー:', error);
    process.exit(1);
  }
}
