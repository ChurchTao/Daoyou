import { InkUIProvider } from '@app/components/providers/InkUIProvider';
import { AuthProvider, useAuth } from '@app/lib/auth/AuthContext';
import { lazy, Suspense } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router';

const GameLayout = lazy(() => import('@app/layouts/game-layout'));
const AdminLayout = lazy(() => import('@app/routes/admin/layout'));
const AdminOverviewPage = lazy(() => import('@app/routes/admin/route'));
const AdminFeedbackPage = lazy(
  () => import('@app/routes/admin/feedback/route'),
);
const AdminEmailBroadcastPage = lazy(
  () => import('@app/routes/admin/broadcast/email/route'),
);
const AdminGameMailBroadcastPage = lazy(
  () => import('@app/routes/admin/broadcast/game-mail/route'),
);
const AdminTemplatesPage = lazy(
  () => import('@app/routes/admin/templates/route'),
);
const AdminTemplateCreatePage = lazy(
  () => import('@app/routes/admin/templates/new/route'),
);
const AdminTemplateDetailPage = lazy(
  () => import('@app/routes/admin/templates/detail/route'),
);
const AdminRedeemCodesPage = lazy(
  () => import('@app/routes/admin/redeem-codes/route'),
);
const AdminRedeemCodeCreatePage = lazy(
  () => import('@app/routes/admin/redeem-codes/new/route'),
);
const AdminCommunityQrcodePage = lazy(
  () => import('@app/routes/admin/community-qrcode/route'),
);
const ArtifactsPage = lazy(() => import('@app/routes/game/artifacts/route'));
const AuctionPage = lazy(() => import('@app/routes/game/auction/route'));
const BattleDetailPage = lazy(
  () => import('@app/routes/game/battle/detail/route'),
);
const BattleChallengePage = lazy(
  () => import('@app/routes/game/battle/challenge/route'),
);
const BattleHistoryPage = lazy(
  () => import('@app/routes/game/battle/history/route'),
);
const BattlePage = lazy(() => import('@app/routes/game/battle/route'));
const BetBattleChallengePage = lazy(
  () => import('@app/routes/game/bet-battle/challenge/route'),
);
const BetBattlePage = lazy(() => import('@app/routes/game/bet-battle/route'));
const CommunityPage = lazy(() => import('@app/routes/game/community/route'));
const CraftAlchemyPage = lazy(
  () => import('@app/routes/game/craft/alchemy/route'),
);
const CraftRefinePage = lazy(
  () => import('@app/routes/game/craft/refine/route'),
);
const CraftPage = lazy(() => import('@app/routes/game/craft/route'));
const CreatePage = lazy(() => import('@app/routes/game/create/route'));
const CultivatorPage = lazy(() => import('@app/routes/game/cultivator/route'));
const DungeonHistoryPage = lazy(
  () => import('@app/routes/game/dungeon/history/route'),
);
const DungeonPage = lazy(() => import('@app/routes/game/dungeon/route'));
const EnlightenmentGongfaPage = lazy(
  () => import('@app/routes/game/enlightenment/gongfa/route'),
);
const EnlightenmentManualDrawPage = lazy(
  () => import('@app/routes/game/enlightenment/manual-draw/route'),
);
const EnlightenmentReplacePage = lazy(
  () => import('@app/routes/game/enlightenment/replace/route'),
);
const EnlightenmentSkillPage = lazy(
  () => import('@app/routes/game/enlightenment/skill/route'),
);
const EnlightenmentPage = lazy(
  () => import('@app/routes/game/enlightenment/route'),
);
const FateReshapePage = lazy(
  () => import('@app/routes/game/fate-reshape/route'),
);
const ForgotPasswordPage = lazy(
  () => import('@app/routes/forgot-password/route'),
);
const GameHomePage = lazy(() => import('@app/routes/game/route'));
const InventoryPage = lazy(() => import('@app/routes/game/inventory/route'));
const LoginEmailPage = lazy(() => import('@app/routes/login/email/route'));
const LoginPage = lazy(() => import('@app/routes/login/route'));
const LoginPasswordPage = lazy(
  () => import('@app/routes/login/password/route'),
);
const LoginVerifyPage = lazy(() => import('@app/routes/login/verify/route'));
const MailPage = lazy(() => import('@app/routes/game/mail/route'));
const MapPage = lazy(() => import('@app/routes/game/map/route'));
const MarketRecyclePage = lazy(
  () => import('@app/routes/game/market/recycle/route'),
);
const MarketPage = lazy(() => import('@app/routes/game/market/route'));
const NotFoundPage = lazy(() => import('@app/routes/not-found'));
const RankingsPage = lazy(() => import('@app/routes/game/rankings/route'));
const RebirthPage = lazy(() => import('@app/routes/game/reincarnate/route'));
const RedeemPage = lazy(() => import('@app/routes/game/redeem/route'));
const ResetPasswordPage = lazy(
  () => import('@app/routes/reset-password/route'),
);
const RetreatPage = lazy(() => import('@app/routes/game/retreat/route'));
const FeedbackPage = lazy(
  () => import('@app/routes/game/settings/feedback/route'),
);
const SignupEmailPage = lazy(() => import('@app/routes/signup/email/route'));
const SignupPage = lazy(() => import('@app/routes/signup/route'));
const SignupPasswordPage = lazy(
  () => import('@app/routes/signup/password/route'),
);
const SignupVerifyPage = lazy(() => import('@app/routes/signup/verify/route'));
const SkillsPage = lazy(() => import('@app/routes/game/skills/route'));
const TechniquesPage = lazy(() => import('@app/routes/game/techniques/route'));
const TrainingRoomPage = lazy(
  () => import('@app/routes/game/training-room/route'),
);
const WorldChatPage = lazy(() => import('@app/routes/game/world-chat/route'));

function LoadingScreen() {
  return (
    <div className="bg-paper flex min-h-screen items-center justify-center">
      <p className="loading-tip">正在进入道界……</p>
    </div>
  );
}

function RootRedirect() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return <Navigate to={user ? '/game' : '/login'} replace />;
}

function GameRouteLayout() {
  return (
    <GameLayout>
      <Outlet />
    </GameLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <InkUIProvider>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/login/email" element={<LoginEmailPage />} />
            <Route path="/login/password" element={<LoginPasswordPage />} />
            <Route path="/login/verify" element={<LoginVerifyPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/signup/email" element={<SignupEmailPage />} />
            <Route path="/signup/password" element={<SignupPasswordPage />} />
            <Route path="/signup/verify" element={<SignupVerifyPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/game" element={<GameRouteLayout />}>
              <Route index element={<GameHomePage />} />
              <Route path="create" element={<CreatePage />} />
              <Route path="cultivator" element={<CultivatorPage />} />
              <Route path="inventory" element={<InventoryPage />} />
              <Route path="skills" element={<SkillsPage />} />
              <Route path="techniques" element={<TechniquesPage />} />
              <Route path="artifacts" element={<ArtifactsPage />} />
              <Route path="craft" element={<CraftPage />} />
              <Route path="craft/alchemy" element={<CraftAlchemyPage />} />
              <Route path="craft/refine" element={<CraftRefinePage />} />
              <Route path="enlightenment" element={<EnlightenmentPage />} />
              <Route
                path="enlightenment/gongfa"
                element={<EnlightenmentGongfaPage />}
              />
              <Route
                path="enlightenment/manual-draw"
                element={<EnlightenmentManualDrawPage />}
              />
              <Route
                path="enlightenment/replace"
                element={<EnlightenmentReplacePage />}
              />
              <Route
                path="enlightenment/skill"
                element={<EnlightenmentSkillPage />}
              />
              <Route path="fate-reshape" element={<FateReshapePage />} />
              <Route path="market" element={<MarketPage />} />
              <Route path="market/recycle" element={<MarketRecyclePage />} />
              <Route path="auction" element={<AuctionPage />} />
              <Route path="battle" element={<BattlePage />} />
              <Route path="battle/history" element={<BattleHistoryPage />} />
              <Route
                path="battle/challenge"
                element={<BattleChallengePage />}
              />
              <Route path="battle/:id" element={<BattleDetailPage />} />
              <Route path="bet-battle" element={<BetBattlePage />} />
              <Route
                path="bet-battle/challenge"
                element={<BetBattleChallengePage />}
              />
              <Route path="rankings" element={<RankingsPage />} />
              <Route path="dungeon" element={<DungeonPage />} />
              <Route path="dungeon/history" element={<DungeonHistoryPage />} />
              <Route path="mail" element={<MailPage />} />
              <Route path="world-chat" element={<WorldChatPage />} />
              <Route path="community" element={<CommunityPage />} />
              <Route path="redeem" element={<RedeemPage />} />
              <Route path="settings/feedback" element={<FeedbackPage />} />
              <Route path="reincarnate" element={<RebirthPage />} />
              <Route path="retreat" element={<RetreatPage />} />
              <Route path="training-room" element={<TrainingRoomPage />} />
              <Route path="map" element={<MapPage />} />
            </Route>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminOverviewPage />} />
              <Route path="feedback" element={<AdminFeedbackPage />} />
              <Route
                path="broadcast/email"
                element={<AdminEmailBroadcastPage />}
              />
              <Route
                path="broadcast/game-mail"
                element={<AdminGameMailBroadcastPage />}
              />
              <Route path="templates" element={<AdminTemplatesPage />} />
              <Route
                path="templates/new"
                element={<AdminTemplateCreatePage />}
              />
              <Route
                path="templates/:id"
                element={<AdminTemplateDetailPage />}
              />
              <Route path="redeem-codes" element={<AdminRedeemCodesPage />} />
              <Route
                path="redeem-codes/new"
                element={<AdminRedeemCodeCreatePage />}
              />
              <Route
                path="community-qrcode"
                element={<AdminCommunityQrcodePage />}
              />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </InkUIProvider>
    </AuthProvider>
  );
}
