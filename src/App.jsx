import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Slider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";

const PRICE_STEP = 50000;
const DEFAULT_MIN_PRICE = 4450000;
const DEFAULT_SOLD_RANGE = "2y";

const SOLD_DATE_OPTIONS = [
  { value: "all", label: "Visa alla datum" },
  { value: "6m", label: "Senaste 6 månaderna" },
  { value: "1y", label: "Senaste 1 året" },
  { value: "2y", label: "Senaste 2 åren" },
  { value: "3y", label: "Senaste 3 åren" },
  { value: "4y", label: "Senaste 4 åren" },
  { value: "5y", label: "Senaste 5 åren" },
];

const SORT_FIELDS = [
  { value: "soldDate", label: "Såld datum" },
  { value: "askingPrice", label: "Utgångspris" },
  { value: "finalPrice", label: "Slutpris" },
  { value: "percentChange", label: "Skillnad" },
];

const VIEW_MODES = [
  { value: "card", label: "Kort" },
  { value: "table", label: "Tabell" },
];

function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [allProperties, setAllProperties] = useState([]);
  const [priceRange, setPriceRange] = useState([0, 0]);
  const [appliedPriceRange, setAppliedPriceRange] = useState([0, 0]);
  const [soldDateRange, setSoldDateRange] = useState(DEFAULT_SOLD_RANGE);
  const [sortField, setSortField] = useState("soldDate");
  const [viewMode, setViewMode] = useState("table");
  const [isSliding, setIsSliding] = useState(false);
  const sliderTimeoutRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        const basePath = import.meta.env.BASE_URL || "/";
        const buildUrl = (file) => `${basePath}data/${file}`;

        const [booliResponse, hemnetResponse] = await Promise.all([
          fetch(buildUrl("booli.json")),
          fetch(buildUrl("hemnet.json")),
        ]);

        if (!booliResponse.ok || !hemnetResponse.ok) {
          throw new Error("Kunde inte ladda data");
        }

        const [booliData, hemnetData] = await Promise.all([
          booliResponse.json(),
          hemnetResponse.json(),
        ]);

        const normalizedBooli = booliData.map((property) =>
          normalizeProperty(property, "booli")
        );
        const normalizedHemnet = hemnetData.map((property) =>
          normalizeProperty(property, "hemnet")
        );

        const combined = [...normalizedBooli, ...normalizedHemnet].sort(
          (a, b) => (getSoldTimestamp(b) ?? 0) - (getSoldTimestamp(a) ?? 0)
        );

        if (isMounted) {
          setAllProperties(combined);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || "Något gick fel när data hämtades");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const priceBounds = useMemo(
    () => getPriceBounds(allProperties),
    [allProperties]
  );

  const defaultMinPrice = useMemo(
    () => getDefaultMinPrice(priceBounds.min, priceBounds.max),
    [priceBounds.min, priceBounds.max]
  );

  useEffect(() => {
    if (priceBounds.max > 0) {
      const initialRange = [defaultMinPrice, priceBounds.max];
      setPriceRange(initialRange);
      setAppliedPriceRange(initialRange);
    }
  }, [priceBounds.max, defaultMinPrice]);

  const soldAfterTimestamp = useMemo(
    () => getLookbackTimestamp(soldDateRange),
    [soldDateRange]
  );

  const { includedProperties, excludedProperties } = useMemo(() => {
    if (!allProperties.length) {
      return { includedProperties: [], excludedProperties: [] };
    }

    const minPrice = appliedPriceRange[0] ?? priceBounds.min;
    const maxPrice = appliedPriceRange[1] ?? priceBounds.max;

    const included = [];
    const excluded = [];

    allProperties.forEach((property) => {
      const priceMatch =
        property.askingPrice >= minPrice && property.askingPrice <= maxPrice;
      const saleTimestamp = getSoldTimestamp(property);
      const dateMatch =
        !soldAfterTimestamp ||
        (saleTimestamp !== null && saleTimestamp >= soldAfterTimestamp);

      if (priceMatch && dateMatch) {
        included.push(property);
      } else {
        excluded.push(property);
      }
    });

    return { includedProperties: included, excludedProperties: excluded };
  }, [
    allProperties,
    priceBounds.min,
    priceBounds.max,
    appliedPriceRange,
    soldAfterTimestamp,
  ]);

  const sortedIncluded = useMemo(
    () => sortProperties(includedProperties, sortField),
    [includedProperties, sortField]
  );

  const sortedExcluded = useMemo(
    () => sortProperties(excludedProperties, sortField),
    [excludedProperties, sortField]
  );

  const stats = useMemo(() => calculateStats(sortedIncluded), [sortedIncluded]);
  const primaryIncludedCount = useMemo(
    () => sortedIncluded.filter((property) => !property.excludeFromStats).length,
    [sortedIncluded]
  );
  const primaryTotalCount = useMemo(
    () => allProperties.filter((property) => !property.excludeFromStats).length,
    [allProperties]
  );

  const handleSliderChange = (_, newValue) => {
    if (!Array.isArray(newValue)) return;
    const [min, max] = newValue;
    const snappedMin = snapToStep(
      clamp(min, priceBounds.min, priceBounds.max),
      PRICE_STEP
    );
    const snappedMax = snapToStep(
      clamp(max, priceBounds.min, priceBounds.max),
      PRICE_STEP
    );

    const normalizedRange = [
      Math.min(snappedMin, snappedMax),
      Math.max(snappedMin, snappedMax),
    ];

    setPriceRange(normalizedRange);
    setIsSliding(true);

    if (sliderTimeoutRef.current) {
      clearTimeout(sliderTimeoutRef.current);
    }

    sliderTimeoutRef.current = setTimeout(() => {
      setAppliedPriceRange(normalizedRange);
      setIsSliding(false);
      sliderTimeoutRef.current = null;
    }, 400);
  };

  const handleSortFieldChange = (event) => {
    setSortField(event.target.value);
  };

  const handleDateRangeChange = (event) => {
    setSoldDateRange(event.target.value);
  };

  const handleViewModeChange = (_, value) => {
    if (value) {
      setViewMode(value);
    }
  };

  const handleResetFilters = () => {
    const resetRange = [defaultMinPrice, priceBounds.max];
    setPriceRange(resetRange);
    setAppliedPriceRange(resetRange);
    setIsSliding(false);
    if (sliderTimeoutRef.current) {
      clearTimeout(sliderTimeoutRef.current);
      sliderTimeoutRef.current = null;
    }
    setSoldDateRange(DEFAULT_SOLD_RANGE);
  };

  useEffect(() => {
    return () => {
      if (sliderTimeoutRef.current) {
        clearTimeout(sliderTimeoutRef.current);
        sliderTimeoutRef.current = null;
      }
    };
  }, []);

  const isDataReady = !loading && !error;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box mb={3}>
        <Typography variant="h4" gutterBottom>
          Prisutveckling inför budgivning på Älvgatan 23
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Egen analys som sammanfattar tidigare slutpriser och marknadsläge i området för att ge stöd inför förhandlingar kring Älvgatan 23.
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, mb: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Filtrera resultat
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={7}>
            <Typography variant="body2" fontWeight={600} mb={1}>
              Prisintervall (utgångspris)
            </Typography>
            <Box mb={2} display="flex" justifyContent="space-between">
              <Typography variant="body1" fontWeight={500}>
                {formatPrice(priceRange[0])} kr
              </Typography>
              <Typography variant="body1" fontWeight={500}>
                {formatPrice(priceRange[1])} kr
              </Typography>
            </Box>
            <Slider
              value={priceRange}
              onChange={handleSliderChange}
              min={priceBounds.min}
              max={priceBounds.max}
              step={PRICE_STEP}
              valueLabelDisplay="off"
              disableSwap
              sx={{
                color: "text.primary",
                "& .MuiSlider-track": { border: "none" },
                "& .MuiSlider-thumb": {
                  width: 18,
                  height: 18,
                  "&:before": { boxShadow: "0 0 0 8px rgba(17, 24, 39, 0.16)" },
                  "&:hover, &.Mui-focusVisible": {
                    boxShadow: "none",
                  },
                },
                "& .MuiSlider-rail": {
                  opacity: 0.4,
                },
              }}
            />
          </Grid>
          <Grid item xs={12} md={5}>
            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel id="sold-date-range-label">Datumintervall</InputLabel>
              <Select
                labelId="sold-date-range-label"
                value={soldDateRange}
                label="Datumintervall"
                onChange={handleDateRangeChange}
              >
                {SOLD_DATE_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel id="sort-field-label">Sortera efter</InputLabel>
              <Select
                labelId="sort-field-label"
                value={sortField}
                label="Sortera efter"
                onChange={handleSortFieldChange}
              >
                {SORT_FIELDS.map((field) => (
                  <MenuItem key={field.value} value={field.value}>
                    {field.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              onClick={handleResetFilters}
              sx={{ mt: 2 }}
            >
              Återställ filter
            </Button>
            {isSliding && (
              <Stack direction="row" spacing={1} alignItems="center" mt={2}>
                <CircularProgress size={16} />
                <Typography variant="body2" color="text.secondary">
                  Uppdaterar resultat...
                </Typography>
              </Stack>
            )}
          </Grid>
        </Grid>
      </Paper>

      {loading && (
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight="40vh"
        >
          <CircularProgress />
        </Box>
      )}

      {isDataReady && (
        <>
          <Grid container spacing={2} mb={3}>
            <Grid item xs={12} md={4}>
              <StatCard
                title="Genomsnitt"
                value={`${stats.average.toFixed(2)}%`}
                emphasis
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <StatCard
                title="Median"
                value={`${stats.median.toFixed(2)}%`}
                emphasis
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <StatCard
                title="Fördelning"
                value={`${primaryIncludedCount} / ${primaryTotalCount}`}
                subtitle="Inkluderade / Totalt"
              />
            </Grid>
          </Grid>

          <Box
            mb={2}
            display="flex"
            flexDirection={{ xs: "column", md: "row" }}
            alignItems={{ xs: "flex-start", md: "center" }}
            justifyContent="space-between"
            gap={2}
          >
            <Typography variant="h6">
              {viewMode === "card" ? "Kortvy" : "Tabellvy"}
            </Typography>
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={handleViewModeChange}
              size="small"
            >
              {VIEW_MODES.map((mode) => (
                <ToggleButton key={mode.value} value={mode.value}>
                  {mode.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>

          {isSliding ? (
            <Paper
              variant="outlined"
              sx={{
                py: 6,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
                bgcolor: "background.default",
              }}
            >
              <CircularProgress />
              <Typography variant="body2" color="text.secondary">
                Uppdaterar resultat baserat på det valda intervallet...
              </Typography>
            </Paper>
          ) : viewMode === "card" ? (
            <CardView included={sortedIncluded} excluded={sortedExcluded} />
          ) : (
            <TableView included={sortedIncluded} excluded={sortedExcluded} />
          )}
        </>
      )}
    </Container>
  );
}

function CardView({ included, excluded }) {
  return (
    <Stack spacing={4}>
      <Box>
        <SectionHeading title="Inkluderade försäljningar" />
        {included.length === 0 ? (
          <EmptyState message="Inga objekt matchar nuvarande filter." />
        ) : (
          <Grid container spacing={2.5}>
            {included.map((property) => (
              <Grid key={property.id} item xs={12} sm={6} md={4}>
                <PropertyCard
                  property={property}
                  muted={property.excludeFromStats}
                />
              </Grid>
            ))}
          </Grid>
        )}
      </Box>

      <Box>
        <SectionHeading title="Exkluderade försäljningar" subdued />
        {excluded.length === 0 ? (
          <EmptyState message="Inga objekt exkluderas med nuvarande filter." />
        ) : (
          <Grid container spacing={2.5}>
            {excluded.map((property) => (
              <Grid key={property.id} item xs={12} sm={6} md={4}>
                <PropertyCard property={property} muted />
              </Grid>
            ))}
          </Grid>
        )}
      </Box>
    </Stack>
  );
}

function PropertyCard({ property, muted = false }) {
  const percentage = Number(property.percentChange) || 0;
  const isShadow = Boolean(property.excludeFromStats);
  const cardMuted = muted || isShadow;
  const percentageColor = cardMuted
    ? "default"
    : percentage >= 0
    ? "success"
    : "error";
  const linkEntries = getLinkEntries(property);
  const isMatched = Boolean(property.matchedGroupId);

  return (
    <Card
      variant="outlined"
      sx={{
        opacity: cardMuted ? 0.45 : 1,
        transition: "box-shadow 0.2s ease, border-color 0.2s ease",
        "&:hover": {
          borderColor: cardMuted ? "divider" : "secondary.light",
          boxShadow: cardMuted ? "none" : "0 12px 24px rgba(15, 23, 42, 0.12)",
        },
      }}
    >
      <CardContent>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="flex-start"
          mb={1}
          gap={1.5}
        >
          <Typography variant="subtitle1" fontWeight={600} sx={{ pr: 1 }}>
            {property.address}
          </Typography>
          <SourceChipGroup property={property} />
        </Box>
        {isMatched && (
          <Typography
            variant="caption"
            color="secondary.main"
            sx={{ fontWeight: 600, mb: 1, display: "inline-block" }}
          >
            {formatMatchLabel(property)}
          </Typography>
        )}
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {property.area}
        </Typography>
        <Stack spacing={0.5}>
          <PropertyInfo
            label="Utgångspris"
            value={`${formatPrice(property.askingPrice)} kr`}
          />
          <PropertyInfo
            label="Slutpris"
            value={`${formatPrice(property.finalPrice)} kr`}
          />
          <PropertyInfo label="Såld" value={formatDate(property.soldDate)} />
        </Stack>
        <Box
          mt={2}
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          gap={2}
        >
          <Chip
            label={`${percentage >= 0 ? "+" : ""}${percentage.toFixed(1)}%`}
            color={percentageColor}
            variant={cardMuted ? "outlined" : "filled"}
            sx={{ fontWeight: 600 }}
          />
          {linkEntries.length > 0 && (
            <Stack direction="row" gap={1} justifyContent="flex-end" flexWrap="wrap">
              {linkEntries.map((entry) => (
                <Button
                  key={`${entry.source}-${entry.href}`}
                  component="a"
                  href={entry.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="small"
                  variant="text"
                  sx={{
                    textTransform: "none",
                    fontWeight: 600,
                    color: "secondary.main",
                    "&:hover": {
                      color: "secondary.dark",
                      textDecoration: "underline",
                    },
                  }}
                >
                  Visa {entry.label} →
                </Button>
              ))}
            </Stack>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

function TableView({ included, excluded }) {
  const rows = useMemo(() => [...included, ...excluded], [included, excluded]);
  const includedIds = useMemo(
    () => new Set(included.map((item) => item.id)),
    [included]
  );

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="medium">
        <TableHead>
          <TableRow>
            <TableCell align="right">Skillnad</TableCell>
            <TableCell>Adress</TableCell>
            <TableCell>Område</TableCell>
            <TableCell align="right">Utgångspris</TableCell>
            <TableCell align="right">Slutpris</TableCell>
            <TableCell align="right">Såld</TableCell>
            <TableCell>Källa</TableCell>
            <TableCell>Länk</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((property) => {
            const includedRow = includedIds.has(property.id);
            const percentage = Number(property.percentChange) || 0;
            const linkEntries = getLinkEntries(property);
            const isShadow = Boolean(property.excludeFromStats);

            return (
              <TableRow
                key={property.id}
                sx={{
                  opacity: includedRow && !isShadow ? 1 : 0.45,
                  fontStyle: isShadow ? "italic" : "normal",
                }}
              >
                <TableCell
                  align="right"
                  sx={{
                    fontWeight: 600,
                    color: percentage >= 0 ? "success.main" : "error.main",
                  }}
                >
                  {percentage >= 0 ? "+" : ""}
                  {percentage.toFixed(1)}%
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight={600}>
                    {property.address}
                  </Typography>
                  {property.matchedGroupId && (
                    <Typography variant="caption" color="secondary.main">
                      {formatMatchLabel(property)}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>{property.area}</TableCell>
                <TableCell align="right">
                  {formatPrice(property.askingPrice)} kr
                </TableCell>
                <TableCell align="right">
                  {formatPrice(property.finalPrice)} kr
                </TableCell>
                <TableCell align="right">
                  {formatDate(property.soldDate)}
                </TableCell>
                <TableCell>
                  <SourceChipGroup property={property} size="small" />
                </TableCell>
                <TableCell>
                  {linkEntries.length ? (
                    <Stack
                      direction="column"
                      spacing={0.5}
                      alignItems="flex-start"
                    >
                      {linkEntries.map((entry) => (
                        <Button
                          key={`${entry.source}-${entry.href}`}
                          component="a"
                          href={entry.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          size="small"
                          sx={{
                            textTransform: "none",
                            fontWeight: 600,
                            color: "secondary.main",
                            "&:hover": {
                              color: "secondary.dark",
                            textDecoration: "underline",
                          },
                        }}
                        >
                          Visa {entry.label} →
                        </Button>
                      ))}
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.disabled">
                      -
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function StatCard({ title, value, subtitle, emphasis = false }) {
  return (
    <Card
      variant="outlined"
      sx={{
        backgroundColor: emphasis ? "#111827" : "background.paper",
        color: emphasis ? "#f9fafb" : "text.primary",
        height: "100%",
      }}
    >
      <CardContent>
        <Typography
          variant="overline"
          color={emphasis ? "rgba(249, 250, 251, 0.72)" : "text.secondary"}
          letterSpacing={1}
        >
          {title}
        </Typography>
        <Typography variant="h4" fontWeight={600} mt={1}>
          {value}
        </Typography>
        {subtitle && (
          <Typography
            variant="body2"
            color={emphasis ? "rgba(249, 250, 251, 0.75)" : "text.secondary"}
          >
            {subtitle}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

function SectionHeading({ title, subdued = false }) {
  return (
    <Box mb={1.5} display="flex" alignItems="center" gap={1}>
      <Typography
        variant="subtitle2"
        color={subdued ? "text.disabled" : "text.secondary"}
        sx={{ textTransform: "uppercase", letterSpacing: 1 }}
      >
        {title}
      </Typography>
      <Box flexGrow={1}>
        <Divider />
      </Box>
    </Box>
  );
}

function PropertyInfo({ label, value }) {
  return (
    <Box display="flex" justifyContent="space-between">
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={500}>
        {value}
      </Typography>
    </Box>
  );
}

function EmptyState({ message }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        py: 5,
        px: 3,
        textAlign: "center",
        bgcolor: "background.default",
        borderStyle: "dashed",
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {message}
      </Typography>
    </Paper>
  );
}

function SourceChipGroup({ property, size = "small" }) {
  const rawEntries = getSourceEntries(property);

  if (!rawEntries.length) {
    return null;
  }

  const deduped = new Map();
  rawEntries.forEach((entry) => {
    const existing = deduped.get(entry.source);
    if (!existing) {
      deduped.set(entry.source, { ...entry });
    } else if (entry.isSelf && !existing.isSelf) {
      deduped.set(entry.source, { ...existing, isSelf: true });
    }
  });

  const entries = Array.from(deduped.values()).sort((a, b) => {
    if (a.isSelf === b.isSelf) {
      return 0;
    }
    return a.isSelf ? -1 : 1;
  });

  return (
    <Stack direction="row" spacing={0.5} flexWrap="wrap">
      {entries.map((entry, index) => {
        const styles = getSourceChipStyle(entry.source, {
          active: Boolean(entry.isSelf),
        });
        const key = `${entry.source}-${entry.id || index}`;

        return (
          <Chip
            key={key}
            size={size}
            label={styles.label}
            sx={{
              textTransform: "none",
              fontWeight: 600,
              bgcolor: styles.bgcolor,
              color: styles.color,
              border: "1px solid",
              borderColor: styles.borderColor,
            }}
          />
        );
      })}
    </Stack>
  );
}

function getSourceEntries(property) {
  if (property?.matchedEntries) {
    const combined = [
      ...(property.matchedEntries.booli || []),
      ...(property.matchedEntries.hemnet || []),
    ];

    if (!combined.length) {
      return property.source ? [{ source: property.source, id: property.id }] : [];
    }

    return combined.map((entry) => ({
      source: entry.source,
      id: entry.id,
      isSelf: entry.id === property.id,
    }));
  }

  return property.source
    ? [{ source: property.source, id: property.id, isSelf: true }]
    : [];
}

function getSourceChipStyle(source, { active = false } = {}) {
  if (source === "hemnet") {
    return active
      ? {
          label: "Hemnet",
          bgcolor: "rgba(22, 163, 74, 0.9)",
          color: "#f0fdf4",
          borderColor: "rgba(22, 163, 74, 0.95)",
        }
      : {
          label: "Hemnet",
          bgcolor: "rgba(22, 163, 74, 0.16)",
          color: "rgba(22, 101, 52, 0.95)",
          borderColor: "rgba(22, 163, 74, 0.35)",
        };
  }

  if (source === "booli") {
    return active
      ? {
          label: "Booli",
          bgcolor: "#111827",
          color: "#f9fafb",
          borderColor: "#0f172a",
        }
      : {
          label: "Booli",
          bgcolor: "rgba(17, 24, 39, 0.12)",
          color: "#111827",
          borderColor: "rgba(17, 24, 39, 0.35)",
        };
  }

  return active
    ? {
        label: "Matchad",
        bgcolor: "rgba(79, 70, 229, 0.45)",
        color: "#ede9fe",
        borderColor: "rgba(79, 70, 229, 0.7)",
      }
    : {
        label: "Matchad",
        bgcolor: "rgba(79, 70, 229, 0.12)",
        color: "rgba(67, 56, 202, 0.95)",
        borderColor: "rgba(79, 70, 229, 0.35)",
      };
}

function getLinkEntries(property) {
  const entries = [];

  if (property?.matchedEntries) {
    const collections = [
      { list: property.matchedEntries.booli, label: "Booli" },
      { list: property.matchedEntries.hemnet, label: "Hemnet" },
    ];

    collections.forEach(({ list, label }) => {
      list?.forEach((entry) => {
        if (entry.url) {
          entries.push({ source: entry.source, href: entry.url, label });
        }
      });
    });
  }

  if (entries.length === 0 && property.url) {
    const fallbackLabel =
      property.source === "hemnet"
        ? "Hemnet"
        : property.source === "booli"
        ? "Booli"
        : "annons";
    entries.push({
      source: property.source || "kombinerad",
      href: property.url,
      label: fallbackLabel,
    });
  }

  const seen = new Set();
  return entries.filter((entry) => {
    const key = `${entry.source}-${entry.href}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function formatMatchLabel(property) {
  if (!property?.matchedEntries) {
    return property.isMatchedSecondary
      ? "Sekundär post"
      : "Matchning av flera källor";
  }

  const sources = [];
  if (property.matchedEntries.booli?.length) {
    sources.push("Booli");
  }
  if (property.matchedEntries.hemnet?.length) {
    sources.push("Hemnet");
  }

  if (!sources.length) {
    return property.isMatchedSecondary
      ? "Sekundär post"
      : "Matchning av flera källor";
  }

  if (property.isMatchedSecondary) {
    return `Sekundär post (${sources.join(" & ")})`;
  }

  if (sources.length === 1) {
    return `Matchning med ${sources[0]}`;
  }

  return `Matchning mellan ${sources.join(" & ")}`;
}

function normalizeProperty(property, source) {
  const area =
    extractArea(property) ||
    property.descriptiveAreaName ||
    property.area ||
    "";

  const askingPrice = getAskingPrice(property);
  const finalPrice = getFinalPrice(property);
  const percentChange = getPercentChange(property, askingPrice, finalPrice);

  return {
    ...property,
    source,
    askingPrice,
    finalPrice,
    percentChange,
    address: property.streetAddress || property.address || "Ingen adress",
    area,
    soldDate: property.soldDate || "",
    id: property.id || property.booliId || `${source}-${Math.random()}`,
    url: generatePropertyUrl(property, source),
  };
}

function extractArea(property) {
  if (typeof property.location === "string") {
    return property.location;
  }

  if (property.location && typeof property.location === "object") {
    return (
      property.location.region?.municipalityName || property.location.area || ""
    );
  }

  return "";
}

function getAskingPrice(property) {
  const candidates = [
    property.askingPrice,
    property.listPrice,
    property.askPrice,
    property.price,
  ];

  for (const candidate of candidates) {
    const parsed = parsePriceValue(candidate);
    if (parsed !== null) {
      return parsed;
    }
  }

  return 0;
}

function getFinalPrice(property) {
  const candidates = [
    property.finalPrice,
    property.soldPrice,
    property.salePrice,
  ];

  for (const candidate of candidates) {
    const parsed = parsePriceValue(candidate);
    if (parsed !== null) {
      return parsed;
    }
  }

  return 0;
}

function parsePriceValue(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number" && !Number.isNaN(value)) {
    return value;
  }

  if (typeof value === "string") {
    const digits = value.replace(/[^\d]/g, "");
    if (!digits) {
      return null;
    }
    return parseInt(digits, 10);
  }

  if (typeof value === "object") {
    if ("raw" in value && value.raw !== undefined) {
      return parsePriceValue(value.raw);
    }
    if ("value" in value && value.value !== undefined) {
      return parsePriceValue(value.value);
    }
    if ("formatted" in value && value.formatted !== undefined) {
      return parsePriceValue(value.formatted);
    }
  }

  return null;
}

function parsePercentageValue(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number" && !Number.isNaN(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace("%", "").replace(",", ".").trim();
    if (!normalized) {
      return null;
    }
    const parsed = parseFloat(normalized);
    return Number.isNaN(parsed) ? null : parsed;
  }

  if (typeof value === "object") {
    if ("raw" in value && value.raw !== undefined) {
      return parsePercentageValue(value.raw);
    }
    if ("value" in value && value.value !== undefined) {
      return parsePercentageValue(value.value);
    }
    if ("formatted" in value && value.formatted !== undefined) {
      return parsePercentageValue(value.formatted);
    }
  }

  return null;
}

function getPercentChange(property, askingPrice, finalPrice) {
  const candidates = [
    property.percentChange,
    property.soldPricePercentageDiff,
    property.percentageChange,
  ];

  for (const candidate of candidates) {
    const parsed = parsePercentageValue(candidate);
    if (parsed !== null) {
      return parsed;
    }
  }

  if (askingPrice > 0 && finalPrice > 0) {
    return ((finalPrice - askingPrice) / askingPrice) * 100;
  }

  return 0;
}

function generatePropertyUrl(property, source) {
  if (property.url) {
    if (property.url.startsWith("http")) {
      return property.url;
    }
    if (property.url.startsWith("/")) {
      return source === "booli"
        ? `https://www.booli.se${property.url}`
        : `https://www.hemnet.se${property.url}`;
    }
  }

  if (source === "booli" && (property.id || property.booliId)) {
    const id = property.id || property.booliId;
    return `https://www.booli.se/annons/${id}`;
  }

  if (source === "hemnet" && property.id) {
    return `https://www.hemnet.se/salda/${property.id}`;
  }

  return null;
}

function getPriceBounds(properties) {
  if (!properties.length) {
    return { min: 0, max: PRICE_STEP };
  }

  const prices = properties
    .map((property) => property.askingPrice)
    .filter(
      (price) => typeof price === "number" && !Number.isNaN(price) && price >= 0
    );

  if (!prices.length) {
    return { min: 0, max: PRICE_STEP };
  }

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  return {
    min: Math.max(
      0,
      snapToStep(Math.floor(minPrice / PRICE_STEP) * PRICE_STEP, PRICE_STEP)
    ),
    max: Math.ceil(maxPrice / PRICE_STEP) * PRICE_STEP,
  };
}

function getDefaultMinPrice(minBound, maxBound) {
  if (maxBound <= minBound) {
    return minBound;
  }

  const snappedDefault = snapToStep(
    Math.max(minBound, DEFAULT_MIN_PRICE),
    PRICE_STEP
  );
  return clamp(snappedDefault, minBound, maxBound);
}

function normalizeSoldRange(option) {
  if (option === "all") {
    return "all";
  }
  if (SOLD_DATE_OPTIONS.some((item) => item.value === option)) {
    return option;
  }
  return DEFAULT_SOLD_RANGE;
}

function computeLookbackDate(option) {
  const normalized = normalizeSoldRange(option);
  if (normalized === "all") {
    return null;
  }

  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const day = now.getUTCDate();

  let monthsDifference = 0;

  if (normalized.endsWith("m")) {
    monthsDifference = parseInt(normalized, 10);
  } else if (normalized.endsWith("y")) {
    monthsDifference = parseInt(normalized, 10) * 12;
  }

  if (Number.isNaN(monthsDifference)) {
    return null;
  }

  const totalMonths = year * 12 + month - monthsDifference;
  let targetYear = Math.floor(totalMonths / 12);
  let targetMonth = totalMonths % 12;

  if (targetMonth < 0) {
    targetMonth += 12;
    targetYear -= 1;
  }

  const firstOfMonth = new Date(Date.UTC(targetYear, targetMonth, 1));
  const maxDay = new Date(
    Date.UTC(targetYear, targetMonth + 1, 0)
  ).getUTCDate();
  const targetDay = Math.min(day, maxDay);
  firstOfMonth.setUTCDate(targetDay);

  return firstOfMonth;
}

function getLookbackTimestamp(option) {
  const date = computeLookbackDate(option);
  return date ? date.getTime() : null;
}

function getSoldTimestamp(property) {
  if (!property || !property.soldDate) {
    return null;
  }
  const parsed = Date.parse(property.soldDate);
  return Number.isNaN(parsed) ? null : parsed;
}

function sortProperties(properties, field) {
  const fieldGetter = (property) => {
    switch (field) {
      case "askingPrice":
        return typeof property.askingPrice === "number"
          ? property.askingPrice
          : null;
      case "finalPrice":
        return typeof property.finalPrice === "number"
          ? property.finalPrice
          : null;
      case "percentChange":
        return typeof property.percentChange === "number"
          ? property.percentChange
          : null;
      case "soldDate":
      default:
        return getSoldTimestamp(property);
    }
  };

  return [...properties].sort((a, b) => {
    const valueA = fieldGetter(a);
    const valueB = fieldGetter(b);

    if (valueA === valueB) {
      if (a.excludeFromStats !== b.excludeFromStats) {
        return a.excludeFromStats ? 1 : -1;
      }
      return 0;
    }
    if (valueA === null || valueA === undefined) {
      return 1;
    }
    if (valueB === null || valueB === undefined) {
      return -1;
    }

    return valueB - valueA;
  });
}

function calculateStats(properties) {
  const usable = properties.filter((property) => !property.excludeFromStats);

  if (!usable.length) {
    return { average: 0, median: 0 };
  }

  const percentages = usable
    .map((property) => property.percentChange)
    .filter((value) => typeof value === "number" && !Number.isNaN(value));

  if (!percentages.length) {
    return { average: 0, median: 0 };
  }

  const average =
    percentages.reduce((total, value) => total + value, 0) / percentages.length;

  const sorted = [...percentages].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? (sorted[middle - 1] + sorted[middle]) / 2
      : sorted[middle];

  return { average, median };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function snapToStep(value, step) {
  return Math.round(value / step) * step;
}

function mergeSources({ booli, hemnet }) {
  const normalizedBooli = booli.map((property) =>
    normalizeProperty(property, "booli")
  );
  const normalizedHemnet = hemnet.map((property) =>
    normalizeProperty(property, "hemnet")
  );

  const hemnetByAddress = buildEntriesByAddress(normalizedHemnet);
  const matchedBooliIds = new Set();
  const matchedHemnetIds = new Set();
  const groups = [];

  normalizedBooli.forEach((booliEntry) => {
    const addressKey = normalizeAddress(booliEntry.address);
    if (!addressKey) {
      return;
    }

    const candidates = hemnetByAddress.get(addressKey);
    if (!candidates || !candidates.length) {
      return;
    }

    let bestCandidate = null;
    let bestScore = null;

    candidates.forEach((candidate) => {
      if (matchedHemnetIds.has(candidate.id)) {
        return;
      }
      const score = evaluateMatch(booliEntry, candidate);
      if (!score) {
        return;
      }
      if (!bestScore || score.score < bestScore.score) {
        bestCandidate = candidate;
        bestScore = score;
      }
    });

    if (bestCandidate && bestScore.score <= 3) {
      matchedBooliIds.add(booliEntry.id);
      matchedHemnetIds.add(bestCandidate.id);

      const groupId = `group-${groups.length + 1}`;
      groups.push({
        id: groupId,
        booli: [booliEntry],
        hemnet: [bestCandidate],
        matchScore: bestScore,
      });
    }
  });

  const primaryRecords = [];
  const secondaryRecords = [];

  groups.forEach((group, index) => {
    const prepared = createGroupRecords(group, index + 1);
    primaryRecords.push(prepared.primary);
    secondaryRecords.push(...prepared.secondary);
    groups[index] = prepared.groupSummary;
  });

  const unmatchedBooli = normalizedBooli.filter(
    (entry) => !matchedBooliIds.has(entry.id)
  );
  const unmatchedHemnet = normalizedHemnet.filter(
    (entry) => !matchedHemnetIds.has(entry.id)
  );

  return {
    combined: [
      ...primaryRecords,
      ...secondaryRecords,
      ...unmatchedBooli,
      ...unmatchedHemnet,
    ],
    groups,
  };
}

function createGroupRecords(group, index) {
  const booli = group.booli || [];
  const hemnet = group.hemnet || [];
  const groupId = `group-${index}`;

  const matchedEntries = {
    booli: booli.map((entry) => ({ ...entry })),
    hemnet: hemnet.map((entry) => ({ ...entry })),
  };

  const allEntries = [...booli, ...hemnet];
  const primaryEntry = hemnet[0] || booli[0];

  const askingPrice = getPreferredValue(
    allEntries,
    "askingPrice",
    primaryEntry.askingPrice
  );
  const finalPrice = getPreferredValue(
    allEntries,
    "finalPrice",
    primaryEntry.finalPrice
  );

  let percentChange = null;
  if (Number.isFinite(askingPrice) && Number.isFinite(finalPrice) && askingPrice) {
    percentChange = ((finalPrice - askingPrice) / askingPrice) * 100;
  }
  if (!Number.isFinite(percentChange)) {
    percentChange = getPreferredValue(
      allEntries,
      "percentChange",
      primaryEntry.percentChange
    );
  }

  const primaryRecord = {
    ...primaryEntry,
    askingPrice: Number.isFinite(askingPrice)
      ? askingPrice
      : primaryEntry.askingPrice,
    finalPrice: Number.isFinite(finalPrice)
      ? finalPrice
      : primaryEntry.finalPrice,
    percentChange: Number.isFinite(percentChange)
      ? percentChange
      : primaryEntry.percentChange,
    matchedGroupId: groupId,
    matchedEntries,
    excludeFromStats: false,
    isMatchedPrimary: true,
  };

  const secondaryRecords = allEntries
    .filter((entry) => entry.id !== primaryEntry.id)
    .map((entry) => ({
      ...entry,
      matchedGroupId: groupId,
      matchedEntries,
      excludeFromStats: true,
      isMatchedSecondary: true,
      shadowOfId: primaryEntry.id,
    }));

  return {
    primary: primaryRecord,
    secondary: secondaryRecords,
    groupSummary: {
      id: groupId,
      booli: matchedEntries.booli,
      hemnet: matchedEntries.hemnet,
      primarySource: primaryRecord.source,
      matchScore: group.matchScore,
    },
  };
}

function buildEntriesByAddress(entries) {
  return entries.reduce((lookup, entry) => {
    const key = normalizeAddress(entry.address);
    if (!key) {
      return lookup;
    }
    if (!lookup.has(key)) {
      lookup.set(key, []);
    }
    lookup.get(key).push(entry);
    return lookup;
  }, new Map());
}

function normalizeAddress(address) {
  return (address || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function evaluateMatch(a, b) {
  const timestampA = getSoldTimestamp(a);
  const timestampB = getSoldTimestamp(b);

  if (timestampA === null || timestampB === null) {
    return null;
  }

  const diffMs = Math.abs(timestampA - timestampB);
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays > 2) {
    return null;
  }

  const finalDiff = calculatePercentDiff(a.finalPrice, b.finalPrice);
  if (!Number.isFinite(finalDiff) || finalDiff > 3) {
    return null;
  }

  const askingDiff = calculatePercentDiff(a.askingPrice, b.askingPrice);
  const percentDiff = calculatePercentDiff(a.percentChange, b.percentChange);

  const score =
    diffDays * 2 +
    (Number.isFinite(finalDiff) ? finalDiff : 3) +
    (Number.isFinite(askingDiff) ? askingDiff / 3 : 1) +
    (Number.isFinite(percentDiff) ? percentDiff / 4 : 0.5);

  return {
    score,
    diffDays,
    finalDiff,
    askingDiff,
    percentDiff,
  };
}

function getPreferredValue(entries, key, fallback) {
  for (const entry of entries) {
    const value = entry[key];
    if (typeof value === "number" && Number.isFinite(value) && value !== 0) {
      return value;
    }
  }
  return fallback;
}

function calculatePercentDiff(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || (a === 0 && b === 0)) {
    return Infinity;
  }
  const diff = Math.abs(a - b);
  const denominator = Math.abs((a + b) / 2) || Math.max(Math.abs(a), Math.abs(b)) || 1;
  return (diff / denominator) * 100;
}

function formatPrice(value) {
  if (value === null || value === undefined) {
    return "N/A";
  }
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return "N/A";
  }
  return numeric.toLocaleString("sv-SE");
}

function formatDate(value) {
  if (!value) {
    return "N/A";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("sv-SE");
}

export default App;
