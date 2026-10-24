/* G-LOVE 受付システムの接続設定（公開されるファイル）
   Supabase の「Project Settings → API」にある2つの値を貼り付ける。
   ・supabaseUrl      … Project URL（https://xxxx.supabase.co）
   ・supabaseAnonKey  … anon public の鍵（公開してよい鍵。service_role の鍵は絶対に書かない）
   接続先のどちらかが空の間は、申込・問い合わせ・紹介コード確認は「送信されていません」と表示し、
   受付完了は表示しない。 */
window.GLOVE_CONFIG = {
  supabaseUrl: "https://mjjmtgrcusnfplftiowm.supabase.co",
  supabaseAnonKey: "sb_publishable_AdIxvk2v71wJFbXhLJU63Q_0-AMhB6z",
  // trial：試験運用（実在の情報を入力しないよう表示する）／live：本番運用
  //  本番に切り替えるときは、データベース側の intake_mode も live にする（接続手順書 第7章）
  mode: "live",
  maxPhotos: 6,
  maxPhotoMB: 8
};
