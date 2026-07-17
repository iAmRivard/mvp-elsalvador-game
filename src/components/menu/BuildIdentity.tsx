import { gameConfig } from '../../config/game.config';

export function BuildIdentity() {
  const shortSha =
    gameConfig.buildSha === 'local'
      ? gameConfig.buildSha
      : gameConfig.buildSha.slice(0, 12);

  return (
    <small
      className="build-identity"
      data-testid="build-identity"
      data-build-sha={gameConfig.buildSha}
      title={`Build ${gameConfig.buildSha}`}
    >
      v{gameConfig.version}
      {' \u00b7 '}
      {shortSha}
    </small>
  );
}
