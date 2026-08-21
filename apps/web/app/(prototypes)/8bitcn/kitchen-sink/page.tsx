// components
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/components/ui/8bit/avatar";
import { Badge } from "@/components/ui/8bit/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/8bit/card";
import { ChartExample } from "@/components/ui/8bit/blocks/chart";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/8bit/empty";
import { Button } from "@/components/ui/8bit/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/8bit/item";
import { Label } from "@/components/ui/8bit/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/8bit/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/8bit/skeleton";
import { Spinner } from "@/components/ui/8bit/spinner";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/8bit/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/8bit/tabs";
import { Leaderboard } from "@/components/ui/8bit/blocks/leaderboard";
// blocks
import ChartBarMultiple from "@/components/ui/8bit/blocks/chart-bar";
import ChartAreaStep from "@/components/ui/8bit/blocks/chart-area-step";
import FriendList from "@/components/ui/8bit/blocks/friend-list";
import Team from "@/components/ui/8bit/blocks/team1";

export default function Page() {
  return (
    <div className="flex flex-col gap-32 items-center justify-center min-h-dvh p-8">
      <h1 className="retro">Blocks</h1>
      <div className="w-full min-w-75">
        <ChartBarMultiple />
      </div>
      <div className="w-full min-w-75">
        <ChartAreaStep />
      </div>
      <div className="w-full">
        <FriendList
          players={[
            {
              id: 1,
              name: "Freaky Knight",
              status: "online",
              avatar: "/avatars/orcdev.jpeg",
              avatarFallback: "OD",
            },
            {
              id: 2,
              name: "Shadow Mage",
              status: "offline",
              avatarFallback: "SM",
            },
            {
              id: 3,
              name: "Dragon Slayer",
              status: "ingame",
              avatarFallback: "DS",
              activity: "In Battle: playing dungeons & dragons",
            },
            {
              id: 4,
              name: "Fire Wizard",
              status: "online",
              avatarFallback: "FW",
            },
            {
              id: 5,
              name: "Ice Wizard jack frost",
              status: "offline",
              avatarFallback: "JK",
            },
            {
              id: 6,
              name: "HellRaiser",
              status: "offline",
              avatarFallback: "H",
            },

            {
              id: 7,
              name: "DarkDragon",
              status: "offline",
              avatarFallback: "D",
            },
          ]}
        />
      </div>
      <div className="w-full">
        <Team />
      </div>
      <div className="w-full">
        <Leaderboard
          players={[
            {
              id: "1",
              name: "OrcDev",
              score: 125000,
              avatar: "/avatars/orcdev.jpeg",
              avatarFallback: "OD",
            },
            {
              id: "2",
              name: "Shadow Mage",
              score: 98500,
              avatarFallback: "S",
            },
          ]}
          maxPlayers={10}
          showRank={true}
          showAvatar={true}
          currentPlayerId="1"
          title="HIGH SCORES"
        />
      </div>
      <h1 className="retro">Components</h1>
      <div>
        <Button>Hello</Button>
      </div>
      <div>
        <Avatar>
          <AvatarImage
            src="https://8bitcn.com/images/pixelized-8bitcnorc.jpg"
            alt="@8bitcn"
          />
          <AvatarFallback>CN</AvatarFallback>
        </Avatar>
      </div>
      <div>
        <Badge>Badge</Badge>
      </div>
      <div>
        <Card>
          <CardHeader>
            <CardTitle>Card Title</CardTitle>
            <CardDescription>Card Description</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Card Content</p>
          </CardContent>
          <CardFooter>
            <p>Card Footer</p>
          </CardFooter>
        </Card>
      </div>
      <div className="w-full min-w-75">
        <ChartExample />
      </div>
      <div>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">🛡️</EmptyMedia>
            <EmptyTitle>No Characters Yet</EmptyTitle>
            <EmptyDescription>
              You haven&apos;t created any Characters yet. Get started by
              creating your first character.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <div className="flex flex-wrap justify-center gap-6">
              <Button>Create Character</Button>
              <Button variant="outline">Import Character</Button>
            </div>
          </EmptyContent>
        </Empty>
      </div>
      <div>
        <ItemGroup>
          <Item variant="outline">
            <ItemContent>
              <ItemTitle>Sword &bull; 300$</ItemTitle>
              <ItemDescription>The demonic sword</ItemDescription>
            </ItemContent>
            <ItemActions>
              <Button variant="outline" size="sm">
                Buy
              </Button>
            </ItemActions>
          </Item>
          <ItemSeparator />
          <Item variant="outline">
            <ItemContent>
              <ItemTitle>Shield &bull; 250$</ItemTitle>
              <ItemDescription>The divine shield</ItemDescription>
            </ItemContent>
            <ItemActions>
              <Button variant="outline" size="sm">
                Buy
              </Button>
            </ItemActions>
          </Item>
        </ItemGroup>
      </div>
      <div>
        <Label>Label</Label>
      </div>
      <div>
        <ScrollArea className="h-[200px] w-[350px] rounded-md border p-4">
          Jokester began sneaking into the castle in the middle of the night and
          leaving jokes all over the place: under the king&apos;s pillow, in his
          soup, even in the royal toilet. The king was furious, but he
          couldn&apos;t seem to stop Jokester. And then, one day, the people of
          the kingdom discovered that the jokes left by Jokester were so funny
          that they couldn&apos;t help but laugh. And once they started
          laughing, they couldn&apos;t stop.
        </ScrollArea>
      </div>
      <div>
        <Select>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Theme" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="light">Light</SelectItem>
            <SelectItem value="dark">Dark</SelectItem>
            <SelectItem value="system">System</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="w-full">
        <Separator />
      </div>
      <div>
        <div className="flex flex-col space-y-5">
          <Skeleton className="h-[125px] w-[250px] rounded-xl" />
          <div className="space-y-4">
            <Skeleton className="h-5 w-[250px]" />
            <Skeleton className="h-5 w-[200px]" />
          </div>
        </div>
      </div>
      <div>
        <Spinner />
      </div>
      <div>
        <Table>
          <TableCaption>A list of your recent invoices.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Invoice</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Method</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">INV001</TableCell>
              <TableCell>Paid</TableCell>
              <TableCell>Credit Card</TableCell>
              <TableCell className="text-right">$250.00</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
      <div>
        <Tabs defaultValue="account" className="w-[400px]">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="password">Password</TabsTrigger>
          </TabsList>
          <TabsContent value="account">
            Make changes to your account here.
          </TabsContent>
          <TabsContent value="password">Change your password here.</TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
