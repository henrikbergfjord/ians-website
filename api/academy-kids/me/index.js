module.exports = async function (context, req) {
  const raw = req.headers['x-ms-client-principal'];
  if (!raw) {
    context.res = { status: 401, jsonBody: { authenticated: false } };
    return;
  }

  try {
    const principal = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    context.res = {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
      jsonBody: {
        authenticated: true,
        userId: principal.userId,
        identityProvider: principal.identityProvider,
        userDetails: principal.userDetails,
        roles: principal.userRoles || []
      }
    };
  } catch (error) {
    context.log.error('Academy Kids principal decode failed', error);
    context.res = { status: 500, jsonBody: { authenticated: false, error: 'identity_decode_failed' } };
  }
};
