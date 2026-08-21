import Link from "next/link";

import { Avatar, AvatarFallback } from "@/components/ui/8bit/avatar";
import { Badge } from "@/components/ui/8bit/badge";
import { Button } from "@/components/ui/8bit/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/8bit/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/8bit/table";

import { PulseSection } from "./pulse-section";
import { SeasonNavigation } from "./season-navigation";

export function LeaderboardsPage({
  title,
  caption,
  current = false,
  year,
  month,
}: {
  title: string;
  caption: string;
  current?: boolean;
  year?: string;
  month?: string;
}) {
  return (
    <div className="flex flex-col gap-10">
      <header className="space-y-6">
        <Button
          variant="ghost"
          render={<Link href="/prototypes/v2-ui/chats" />}
          nativeButton={false}
          role="link"
          className="px-0"
        >
          ← Чаты
        </Button>

        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-4">
            <Badge variant="outline">{caption}</Badge>
            <div className="space-y-3">
              <h1>{title}</h1>
            </div>
          </div>

          {current ? (
            <Button
              variant="outline"
              nativeButton={false}
              role="link"
              render={<Link href="/prototypes/v2-ui/leaderboards/2025" />}
            >
              Прошлые сезоны
            </Button>
          ) : null}
        </div>

        {year ? <SeasonNavigation year={year} month={month} /> : null}
      </header>

      <PulseSection />

      <section className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <section aria-labelledby="respected-title">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>
                  <h3 id="respected-title">Уважаемые люди</h3>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 sm:px-4">
                <Table
                  variant="borderless"
                  aria-label="Уважаемые люди"
                  className="w-full table-fixed"
                >
                  <TableCaption className="sr-only">
                    Уважаемые люди
                  </TableCaption>
                  <TableHeader className="sr-only">
                    <TableRow>
                      <TableHead scope="col">Участник</TableHead>
                      <TableHead scope="col">Результат</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="w-4/5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar variant="pixel" className="size-9">
                            <AvatarFallback>М</AvatarFallback>
                          </Avatar>
                          <span>👑 Марина</span>
                        </div>
                      </TableCell>
                      <TableCell className="w-1/5 py-3">128</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="w-4/5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar variant="pixel" className="size-9">
                            <AvatarFallback>И</AvatarFallback>
                          </Avatar>
                          <span>Илья</span>
                        </div>
                      </TableCell>
                      <TableCell className="w-1/5 py-3">114</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="w-4/5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar variant="pixel" className="size-9">
                            <AvatarFallback>С</AvatarFallback>
                          </Avatar>
                          <span>Соня</span>
                        </div>
                      </TableCell>
                      <TableCell className="w-1/5 py-3">101</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="w-4/5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar variant="pixel" className="size-9">
                            <AvatarFallback>Л</AvatarFallback>
                          </Avatar>
                          <span>Лёша</span>
                        </div>
                      </TableCell>
                      <TableCell className="w-1/5 py-3">88</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="w-4/5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar variant="pixel" className="size-9">
                            <AvatarFallback>Р</AvatarFallback>
                          </Avatar>
                          <span>Рита 🐔</span>
                        </div>
                      </TableCell>
                      <TableCell className="w-1/5 py-3">76</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </section>

          <section aria-labelledby="comedians-title">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>
                  <h3 id="comedians-title">Юмористы</h3>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 sm:px-4">
                <Table
                  variant="borderless"
                  aria-label="Юмористы"
                  className="w-full table-fixed"
                >
                  <TableCaption className="sr-only">Юмористы</TableCaption>
                  <TableHeader className="sr-only">
                    <TableRow>
                      <TableHead scope="col">Участник</TableHead>
                      <TableHead scope="col">Результат</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="w-4/5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar variant="pixel" className="size-9">
                            <AvatarFallback>С</AvatarFallback>
                          </Avatar>
                          <span>👑 Соня</span>
                        </div>
                      </TableCell>
                      <TableCell className="w-1/5 py-3">94</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="w-4/5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar variant="pixel" className="size-9">
                            <AvatarFallback>Л</AvatarFallback>
                          </Avatar>
                          <span>Лёша</span>
                        </div>
                      </TableCell>
                      <TableCell className="w-1/5 py-3">82</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="w-4/5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar variant="pixel" className="size-9">
                            <AvatarFallback>Р</AvatarFallback>
                          </Avatar>
                          <span>Рита</span>
                        </div>
                      </TableCell>
                      <TableCell className="w-1/5 py-3">73</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="w-4/5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar variant="pixel" className="size-9">
                            <AvatarFallback>Т</AvatarFallback>
                          </Avatar>
                          <span>Тимур</span>
                        </div>
                      </TableCell>
                      <TableCell className="w-1/5 py-3">61</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="w-4/5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar variant="pixel" className="size-9">
                            <AvatarFallback>М</AvatarFallback>
                          </Avatar>
                          <span>Марина 🐔</span>
                        </div>
                      </TableCell>
                      <TableCell className="w-1/5 py-3">49</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </section>

          <section aria-labelledby="positive-title">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>
                  <h3 id="positive-title">На позитиве</h3>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 sm:px-4">
                <Table
                  variant="borderless"
                  aria-label="На позитиве"
                  className="w-full table-fixed"
                >
                  <TableCaption className="sr-only">На позитиве</TableCaption>
                  <TableHeader className="sr-only">
                    <TableRow>
                      <TableHead scope="col">Участник</TableHead>
                      <TableHead scope="col">Результат</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="w-4/5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar variant="pixel" className="size-9">
                            <AvatarFallback>Р</AvatarFallback>
                          </Avatar>
                          <span>👑 Рита</span>
                        </div>
                      </TableCell>
                      <TableCell className="w-1/5 py-3">156</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="w-4/5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar variant="pixel" className="size-9">
                            <AvatarFallback>Т</AvatarFallback>
                          </Avatar>
                          <span>Тимур</span>
                        </div>
                      </TableCell>
                      <TableCell className="w-1/5 py-3">141</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="w-4/5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar variant="pixel" className="size-9">
                            <AvatarFallback>М</AvatarFallback>
                          </Avatar>
                          <span>Марина</span>
                        </div>
                      </TableCell>
                      <TableCell className="w-1/5 py-3">127</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="w-4/5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar variant="pixel" className="size-9">
                            <AvatarFallback>И</AvatarFallback>
                          </Avatar>
                          <span>Илья</span>
                        </div>
                      </TableCell>
                      <TableCell className="w-1/5 py-3">109</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="w-4/5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar variant="pixel" className="size-9">
                            <AvatarFallback>С</AvatarFallback>
                          </Avatar>
                          <span>Соня 🐔</span>
                        </div>
                      </TableCell>
                      <TableCell className="w-1/5 py-3">93</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </section>

          <section aria-labelledby="laughing-title">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>
                  <h3 id="laughing-title">Хотят смеяться 5 минут</h3>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 sm:px-4">
                <Table
                  variant="borderless"
                  aria-label="Хотят смеяться 5 минут"
                  className="w-full table-fixed"
                >
                  <TableCaption className="sr-only">
                    Хотят смеяться 5 минут
                  </TableCaption>
                  <TableHeader className="sr-only">
                    <TableRow>
                      <TableHead scope="col">Участник</TableHead>
                      <TableHead scope="col">Результат</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="w-4/5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar variant="pixel" className="size-9">
                            <AvatarFallback>М</AvatarFallback>
                          </Avatar>
                          <span>👑 Марина</span>
                        </div>
                      </TableCell>
                      <TableCell className="w-1/5 py-3">84</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="w-4/5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar variant="pixel" className="size-9">
                            <AvatarFallback>И</AvatarFallback>
                          </Avatar>
                          <span>Илья</span>
                        </div>
                      </TableCell>
                      <TableCell className="w-1/5 py-3">75</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="w-4/5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar variant="pixel" className="size-9">
                            <AvatarFallback>С</AvatarFallback>
                          </Avatar>
                          <span>Соня</span>
                        </div>
                      </TableCell>
                      <TableCell className="w-1/5 py-3">62</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="w-4/5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar variant="pixel" className="size-9">
                            <AvatarFallback>Л</AvatarFallback>
                          </Avatar>
                          <span>Лёша</span>
                        </div>
                      </TableCell>
                      <TableCell className="w-1/5 py-3">53</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="w-4/5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar variant="pixel" className="size-9">
                            <AvatarFallback>Р</AvatarFallback>
                          </Avatar>
                          <span>Рита 🐔</span>
                        </div>
                      </TableCell>
                      <TableCell className="w-1/5 py-3">41</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </section>

          <section aria-labelledby="burning-title">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>
                  <h3 id="burning-title">Как же у них горит</h3>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 sm:px-4">
                <Table
                  variant="borderless"
                  aria-label="Как же у них горит"
                  className="w-full table-fixed"
                >
                  <TableCaption className="sr-only">
                    Как же у них горит
                  </TableCaption>
                  <TableHeader className="sr-only">
                    <TableRow>
                      <TableHead scope="col">Участник</TableHead>
                      <TableHead scope="col">Результат</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="w-4/5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar variant="pixel" className="size-9">
                            <AvatarFallback>С</AvatarFallback>
                          </Avatar>
                          <span>👑 Соня</span>
                        </div>
                      </TableCell>
                      <TableCell className="w-1/5 py-3">52</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="w-4/5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar variant="pixel" className="size-9">
                            <AvatarFallback>Л</AvatarFallback>
                          </Avatar>
                          <span>Лёша</span>
                        </div>
                      </TableCell>
                      <TableCell className="w-1/5 py-3">44</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="w-4/5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar variant="pixel" className="size-9">
                            <AvatarFallback>Р</AvatarFallback>
                          </Avatar>
                          <span>Рита</span>
                        </div>
                      </TableCell>
                      <TableCell className="w-1/5 py-3">37</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="w-4/5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar variant="pixel" className="size-9">
                            <AvatarFallback>Т</AvatarFallback>
                          </Avatar>
                          <span>Тимур</span>
                        </div>
                      </TableCell>
                      <TableCell className="w-1/5 py-3">29</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="w-4/5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar variant="pixel" className="size-9">
                            <AvatarFallback>М</AvatarFallback>
                          </Avatar>
                          <span>Марина 🐔</span>
                        </div>
                      </TableCell>
                      <TableCell className="w-1/5 py-3">18</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </section>
        </div>
      </section>
    </div>
  );
}
